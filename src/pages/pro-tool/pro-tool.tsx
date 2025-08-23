import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { motion } from "framer-motion";
import { ArrowUp, ArrowDown, Hash, Sigma, Dice5 } from "lucide-react";
import { localize } from '@deriv-com/translations';
import { generateDerivApiInstance, V2GetActiveClientId, V2GetActiveToken } from '@/external/bot-skeleton/services/api/appId';
import { tradeOptionToBuy } from '@/external/bot-skeleton/services/tradeEngine/utils/helpers';
import { contract_stages } from '@/constants/contract-stage';
import { useStore } from '@/hooks/useStore';
import './pro-tool.scss';

// Simple Switch component
const Switch = ({ checked, onCheckedChange, className = "" }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) => (
  <label className={`switch ${className}`}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
    <span className="slider"></span>
  </label>
);

// Types
interface Symbol {
  symbol: string;
  display_name: string;
}

/**
 * THEME HELPERS
 */
const themes = {
  digits: {
    name: "Over / Under (Digits)",
    icon: Sigma,
    gradient: "from-blue-500 via-sky-500 to-cyan-500",
    shadow: "rgba(59,130,246,0.45)",
  },
  evenodd: {
    name: "Even / Odd",
    icon: Dice5,
    gradient: "from-fuchsia-500 via-purple-500 to-indigo-500",
    shadow: "rgba(168,85,247,0.45)",
  },
  risefall: {
    name: "Rise / Fall",
    icon: ArrowUp,
    gradient: "from-emerald-500 via-green-500 to-lime-500",
    shadow: "rgba(16,185,129,0.45)",
  },
  matchdiff: {
    name: "Matches / Differs",
    icon: Hash,
    gradient: "from-rose-500 via-red-500 to-orange-500",
    shadow: "rgba(244,63,94,0.45)",
  },
};

/**
 * REUSABLE TRADE CARD
 */
function TradeCard({ themeKey, children, statusText, onTradeOnce, onStartAuto, onStopAuto }: {
  themeKey: keyof typeof themes;
  children: (props: { isAuto: boolean; setIsAuto: (value: boolean) => void }) => React.ReactNode;
  statusText?: string;
  onTradeOnce?: () => void;
  onStartAuto?: () => void;
  onStopAuto?: () => void;
}) {
  const theme = themes[themeKey];
  const Icon = theme.icon;
  const [isAuto, setIsAuto] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, boxShadow: `0 20px 35px ${theme.shadow}` }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className="trade-card"
    >
      <div className="trade-card">
        {/* Header */}
        <div className={`card-header ${themeKey}`}>
          <div className="header-content">
            <div className="icon-wrapper">
              <Icon size={20} />
            </div>
            <h3>{theme.name}</h3>
          </div>

          {/* Status badge */}
          <div className={`status-badge ${isAuto ? "active" : "inactive"}`}>
            <span className={`status-dot ${isAuto ? "active" : "inactive"}`} />
            {isAuto ? "Auto Trade Active" : "Stopped"}
          </div>
        </div>

        <div className="card-content">
          {/* Content from specific card */}
          <div className="form-section">
            {children({ isAuto, setIsAuto })}
          </div>

          {/* Toggle + Start/Stop Controls */}
          <div className="controls-section">
            <div className="control-label">
              <span>{isAuto ? "Auto Trade" : "Trade Once"}</span>
              <Switch checked={isAuto} onCheckedChange={setIsAuto} className={isAuto ? "animate-pulse" : ""} />
            </div>

            <div className="control-buttons">
              {!isAuto && (
                <button className="btn-primary" onClick={onTradeOnce}>Trade Once</button>
              )}
              {isAuto && (
                <>
                  <button className="btn-primary" onClick={onStartAuto}>Start Auto</button>
                  <button className="btn-danger" onClick={onStopAuto}>Stop Auto</button>
                </>
              )}
            </div>
          </div>

          {/* Footer preview */}
          {statusText && (
            <div className="status-footer">
              {statusText}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * PAGE
 */
const TradeUiClone = observer(() => {
  const { run_panel, transactions } = useStore();

  // API and connection state
  const apiRef = useRef<any>(null);
  const tickStreamIdRef = useRef<string | null>(null);
  const stopFlagRef = useRef(false);
  const lastOutcomeWasLossRef = useRef(false);

  // Trading state
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [symbol, setSymbol] = useState('');
  const [account_currency, setAccountCurrency] = useState('USD');
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [digits, setDigits] = useState<number[]>([]);
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [ticksProcessed, setTicksProcessed] = useState(0);

  // Shared inputs (example can be wired to real handlers later)
  const [stake, setStake] = useState(1);
  const [ticks, setTicks] = useState(5);

  // Digits state
  const [digitMode, setDigitMode] = useState("over");
  const [predictionDigit, setPredictionDigit] = useState(7);

  // Even/Odd state
  const [parity, setParity] = useState("even");

  // Rise/Fall state
  const [direction, setDirection] = useState("rise");

  // Matches/Differs state
  const [matchType, setMatchType] = useState("matches");
  const [matchDigit, setMatchDigit] = useState(4);

  // API initialization
  useEffect(() => {
    const api = generateDerivApiInstance();
    apiRef.current = api;
    const init = async () => {
      try {
        // Fetch active symbols (volatility indices)
        const { active_symbols, error: asErr } = await api.send({ active_symbols: 'brief' });
        if (asErr) throw asErr;
        const syn = (active_symbols || [])
          .filter((s: any) => /synthetic/i.test(s.market) || /^R_/.test(s.symbol))
          .map((s: any) => ({ symbol: s.symbol, display_name: s.display_name }));
        setSymbols(syn);
        if (!symbol && syn[0]?.symbol) setSymbol(syn[0].symbol);
        if (syn[0]?.symbol) startTicks(syn[0].symbol);
      } catch (e: any) {
        console.error('ProTrader init error', e);
        setStatus(`Init error: ${e?.message || 'Unknown'}`);
      }
    };
    init();

    return () => {
      stopTicks();
      if (apiRef.current) {
        apiRef.current.disconnect?.();
      }
    };
  }, []);

  // Authorization helper
  const authorizeIfNeeded = async () => {
    const token = V2GetActiveToken();
    const clientId = V2GetActiveClientId();
    if (!token || !clientId) {
      throw new Error('No active token or client ID found');
    }
    try {
      const { authorize, error } = await apiRef.current.authorize(token);
      if (error) throw error;
      setAccountCurrency(authorize?.currency || 'USD');
      return authorize;
    } catch (e: any) {
      throw new Error(`Authorization failed: ${e?.message || 'Unknown'}`);
    }
  };

  // Start tick stream
  const startTicks = async (sym: string) => {
    stopTicks();
    setDigits([]);
    setLastDigit(null);
    setTicksProcessed(0);
    try {
      const { subscription, error } = await apiRef.current.send({ ticks: sym, subscribe: 1 });
      if (error) throw error;
      if (subscription?.id) tickStreamIdRef.current = subscription.id;

      const onMsg = (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data as any);
          if (data?.msg_type === 'tick' && data?.tick?.symbol === sym) {
            const quote = data.tick.quote;
            const digit = Number(String(quote).slice(-1));
            setLastDigit(digit);
            setDigits(prev => [...prev.slice(-8), digit]);
            setTicksProcessed(prev => prev + 1);
          }
        } catch {}
      };
      apiRef.current?.connection?.addEventListener('message', onMsg);
    } catch (e: any) {
      console.error('startTicks error', e);
      setStatus(`Tick stream error: ${e?.message || 'Unknown'}`);
    }
  };

  // Stop tick stream
  const stopTicks = () => {
    if (tickStreamIdRef.current && apiRef.current) {
      apiRef.current.forget?.({ forget: tickStreamIdRef.current });
      tickStreamIdRef.current = null;
    }
  };

  // Purchase contract function
  const purchaseContract = async (tradeType: string, prediction?: number) => {
    await authorizeIfNeeded();

    const trade_option: any = {
      amount: Number(stake),
      basis: 'stake',
      contractTypes: [tradeType],
      currency: account_currency,
      duration: Number(ticks),
      duration_unit: 't',
      symbol,
    };

    if (prediction !== undefined) {
      trade_option.prediction = Number(prediction);
    }

    const buy_req = tradeOptionToBuy(tradeType, trade_option);
    const { buy, error } = await apiRef.current.buy(buy_req);
    if (error) throw error;

    setStatus(`Purchased: ${buy?.longcode || 'Contract'} (ID: ${buy?.contract_id})`);

    // Add to transactions like Smart Trader
    try {
      const symbol_display = symbols.find(s => s.symbol === symbol)?.display_name || symbol;
      transactions.onBotContractEvent({
        contract_id: buy?.contract_id,
        transaction_ids: { buy: buy?.transaction_id },
        buy_price: buy?.buy_price,
        currency: account_currency,
        contract_type: tradeType as any,
        underlying: symbol,
        display_name: symbol_display,
        date_start: Math.floor(Date.now() / 1000),
        status: 'open',
      } as any);
    } catch {}

    // Subscribe to contract updates
    try {
      const res = await apiRef.current.send({
        proposal_open_contract: 1,
        contract_id: buy?.contract_id,
        subscribe: 1,
      });
      const { error, proposal_open_contract: pocInit, subscription } = res || {};
      if (error) throw error;

      let pocSubId: string | null = subscription?.id || null;
      const targetId = String(buy?.contract_id || '');

      if (pocInit && String(pocInit?.contract_id || '') === targetId) {
        transactions.onBotContractEvent(pocInit);
      }

      const onMsg = (evt: MessageEvent) => {
        try {
          const data = JSON.parse(evt.data as any);
          if (data?.msg_type === 'proposal_open_contract') {
            const poc = data.proposal_open_contract;
            if (!pocSubId && data?.subscription?.id) pocSubId = data.subscription.id;
            if (String(poc?.contract_id || '') === targetId) {
              transactions.onBotContractEvent(poc);
              if (poc?.is_sold || poc?.status === 'sold') {
                if (pocSubId) apiRef.current?.forget?.({ forget: pocSubId });
                apiRef.current?.connection?.removeEventListener('message', onMsg);
                const profit = Number(poc?.profit || 0);
                lastOutcomeWasLossRef.current = profit <= 0;
              }
            }
          }
        } catch {}
      };
      apiRef.current?.connection?.addEventListener('message', onMsg);
    } catch (subErr) {
      console.error('subscribe poc error', subErr);
    }

    return buy;
  };

  // Trade handlers for each card type
  const handleDigitsTrade = async () => {
    try {
      setStatus('Processing...');
      const tradeType = digitMode === 'over' ? 'DIGITOVER' : 'DIGITUNDER';
      await purchaseContract(tradeType, predictionDigit);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || 'Unknown'}`);
    }
  };

  const handleEvenOddTrade = async () => {
    try {
      setStatus('Processing...');
      const tradeType = parity === 'even' ? 'DIGITEVEN' : 'DIGITODD';
      await purchaseContract(tradeType);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || 'Unknown'}`);
    }
  };

  const handleRiseFallTrade = async () => {
    try {
      setStatus('Processing...');
      const tradeType = direction === 'rise' ? 'CALL' : 'PUT';
      await purchaseContract(tradeType);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || 'Unknown'}`);
    }
  };

  const handleMatchDiffTrade = async () => {
    try {
      setStatus('Processing...');
      const tradeType = matchType === 'matches' ? 'DIGITMATCH' : 'DIGITDIFF';
      await purchaseContract(tradeType, matchDigit);
    } catch (e: any) {
      setStatus(`Error: ${e?.message || 'Unknown'}`);
    }
  };

  return (
    <div className="pro-trader">
      <h1>Pro Trader</h1>

      {/* Status and Symbol Info */}
      <div style={{ textAlign: 'center', marginBottom: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '0.5rem', maxWidth: '800px', margin: '0 auto 2rem auto' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Symbol:</strong> {symbols.find(s => s.symbol === symbol)?.display_name || symbol || 'Loading...'}
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Last Digit:</strong> {lastDigit !== null ? lastDigit : 'Waiting...'}
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <strong>Ticks Processed:</strong> {ticksProcessed}
        </div>
        {status && (
          <div style={{ color: status.includes('Error') ? '#dc2626' : '#059669', fontWeight: 'bold' }}>
            {status}
          </div>
        )}
      </div>

      <div className="trade-grid">
        {/* Over/Under (Digits) */}
        <TradeCard
          themeKey="digits"
          statusText={`Trading ${digitMode.toUpperCase()} ${predictionDigit} • Stake ${stake} • Ticks ${ticks}`}
          onTradeOnce={handleDigitsTrade}
        >
          {() => (
            <div className="form-grid">
              <div className="form-field">
                <label>Trade Type</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="digits-type"
                      value="over"
                      checked={digitMode === "over"}
                      onChange={() => setDigitMode("over")}
                    />
                    Over
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="digits-type"
                      value="under"
                      checked={digitMode === "under"}
                      onChange={() => setDigitMode("under")}
                    />
                    Under
                  </label>
                </div>
              </div>

              <div className="form-field">
                <label>Prediction Digit</label>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={predictionDigit}
                  onChange={(e) => setPredictionDigit(Number(e.target.value))}
                />
              </div>

              <div className="form-field">
                <label>Stake</label>
                <input
                  type="number"
                  min={0}
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                />
              </div>

              <div className="form-field">
                <label>Ticks</label>
                <input
                  type="number"
                  min={1}
                  value={ticks}
                  onChange={(e) => setTicks(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </TradeCard>

        {/* Even / Odd */}
        <TradeCard
          themeKey="evenodd"
          statusText={`Trading ${parity.toUpperCase()} • Stake ${stake} • Ticks ${ticks}`}
          onTradeOnce={handleEvenOddTrade}
        >
          {() => (
            <div className="form-grid">
              <div className="form-field">
                <label>Select</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="parity"
                      value="even"
                      checked={parity === "even"}
                      onChange={() => setParity("even")}
                    />
                    Even
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="parity"
                      value="odd"
                      checked={parity === "odd"}
                      onChange={() => setParity("odd")}
                    />
                    Odd
                  </label>
                </div>
              </div>

              <div className="form-field">
                <label>Stake</label>
                <input
                  type="number"
                  min={0}
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                />
              </div>

              <div className="form-field">
                <label>Ticks</label>
                <input
                  type="number"
                  min={1}
                  value={ticks}
                  onChange={(e) => setTicks(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </TradeCard>

        {/* Rise / Fall */}
        <TradeCard
          themeKey="risefall"
          statusText={`Trading ${direction.toUpperCase()} • Stake ${stake} • Ticks ${ticks}`}
          onTradeOnce={handleRiseFallTrade}
        >
          {() => (
            <div className="form-grid">
              <div className="form-field">
                <label>Direction</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="direction"
                      value="rise"
                      checked={direction === "rise"}
                      onChange={() => setDirection("rise")}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Rise <ArrowUp size={14} />
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="direction"
                      value="fall"
                      checked={direction === "fall"}
                      onChange={() => setDirection("fall")}
                    />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      Fall <ArrowDown size={14} />
                    </span>
                  </label>
                </div>
              </div>

              <div className="form-field">
                <label>Stake</label>
                <input
                  type="number"
                  min={0}
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                />
              </div>

              <div className="form-field">
                <label>Ticks</label>
                <input
                  type="number"
                  min={1}
                  value={ticks}
                  onChange={(e) => setTicks(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </TradeCard>

        {/* Matches / Differs */}
        <TradeCard
          themeKey="matchdiff"
          statusText={`Trading ${matchType.toUpperCase()} ${matchType === "matches" ? matchDigit : "(any except " + matchDigit + ")"} • Stake ${stake} • Ticks ${ticks}`}
          onTradeOnce={handleMatchDiffTrade}
        >
          {() => (
            <div className="form-grid">
              <div className="form-field">
                <label>Type</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="matchType"
                      value="matches"
                      checked={matchType === "matches"}
                      onChange={() => setMatchType("matches")}
                    />
                    Matches
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="matchType"
                      value="differs"
                      checked={matchType === "differs"}
                      onChange={() => setMatchType("differs")}
                    />
                    Differs
                  </label>
                </div>
              </div>

              <div className="form-field">
                <label>Digit</label>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={matchDigit}
                  onChange={(e) => setMatchDigit(Number(e.target.value))}
                />
              </div>

              <div className="form-field">
                <label>Stake</label>
                <input
                  type="number"
                  min={0}
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                />
              </div>

              <div className="form-field">
                <label>Ticks</label>
                <input
                  type="number"
                  min={1}
                  value={ticks}
                  onChange={(e) => setTicks(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </TradeCard>
      </div>
    </div>
  );
});

export default TradeUiClone;
