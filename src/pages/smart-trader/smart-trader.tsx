import React, { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import Text from '@/components/shared_ui/text';
import { localize } from '@deriv-com/translations';
import { generateDerivApiInstance, V2GetActiveToken } from '@/external/bot-skeleton/services/api/appId';
import { tradeOptionToBuy } from '@/external/bot-skeleton/services/tradeEngine/utils/helpers';
import './smart-trader.scss';

// Minimal trade types we will support initially
const TRADE_TYPES = [
    { value: 'DIGITOVER', label: 'Digits Over' },
    { value: 'DIGITUNDER', label: 'Digits Under' },
    { value: 'DIGITEVEN', label: 'Even' },
    { value: 'DIGITODD', label: 'Odd' },
    { value: 'DIGITMATCH', label: 'Matches' },
    { value: 'DIGITDIFF', label: 'Differs' },
];

const SmartTrader = observer(() => {
    const apiRef = useRef<any>(null);
    const [is_authorized, setIsAuthorized] = useState(false);
    const [account_currency, setAccountCurrency] = useState<string>('USD');
    const [symbols, setSymbols] = useState<Array<{ symbol: string; display_name: string }>>([]);

    // Form state
    const [symbol, setSymbol] = useState<string>('');
    const [tradeType, setTradeType] = useState<string>('DIGITOVER');
    const [ticks, setTicks] = useState<number>(1);
    const [stake, setStake] = useState<number>(0.5);
    const [prediction, setPrediction] = useState<number>(5);

    const [status, setStatus] = useState<string>('');
    const [is_running, setIsRunning] = useState(false);

    const needsPrediction = useMemo(() => tradeType === 'DIGITOVER' || tradeType === 'DIGITUNDER', [tradeType]);

    useEffect(() => {
        // Initialize API connection and fetch active symbols
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
            } catch (e: any) {
                // eslint-disable-next-line no-console
                console.error('SmartTrader init error', e);
                setStatus(e?.message || 'Failed to load symbols');
            }
        };
        init();

        return () => {
            try { api?.disconnect?.(); } catch { /* noop */ }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const authorizeIfNeeded = async () => {
        if (is_authorized) return;
        const token = V2GetActiveToken();
        if (!token) {
            setStatus('No token found. Please log in and select an account.');
            throw new Error('No token');
        }
        const { authorize, error } = await apiRef.current.authorize(token);
        if (error) {
            setStatus(`Authorization error: ${error.message || error.code}`);
            throw error;
        }
        setIsAuthorized(true);
        setAccountCurrency(authorize?.currency || 'USD');
    };

    const onRun = async () => {
        setStatus('');
        setIsRunning(true);
        try {
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
            if (needsPrediction) trade_option.prediction = Number(prediction);

            const buy_req = tradeOptionToBuy(tradeType, trade_option);
            const { buy, error } = await apiRef.current.buy(buy_req);
            if (error) throw error;

            setStatus(`Purchased: ${buy?.longcode || 'Contract'} (ID: ${buy?.contract_id})`);
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('SmartTrader run error', e);
            const msg = e?.message || e?.error?.message || 'Something went wrong';
            setStatus(`Error: ${msg}`);
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className='smart-trader'>
            <div className='smart-trader__container'>
                <div className='smart-trader__header'>
                    <Text size='xl' weight='bold' color='prominent'>
                        {localize('Smart Trader')}
                    </Text>
                    <Text size='s' color='general'>
                        {localize('Quick digits trading with Deriv API')}
                    </Text>
                </div>

                <div className='smart-trader__content'>
                    <div className='smart-trader__card'>
                        <div className='smart-trader__row'>
                            <div className='smart-trader__field'>
                                <label htmlFor='st-symbol'>{localize('Volatility')}</label>
                                <select
                                    id='st-symbol'
                                    value={symbol}
                                    onChange={e => setSymbol(e.target.value)}
                                >
                                    {symbols.map(s => (
                                        <option key={s.symbol} value={s.symbol}>
                                            {s.display_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='smart-trader__field'>
                                <label htmlFor='st-tradeType'>{localize('Trade type')}</label>
                                <select
                                    id='st-tradeType'
                                    value={tradeType}
                                    onChange={e => setTradeType(e.target.value)}
                                >
                                    {TRADE_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className='smart-trader__row'>
                            <div className='smart-trader__field'>
                                <label htmlFor='st-ticks'>{localize('Ticks')}</label>
                                <input
                                    id='st-ticks'
                                    type='number'
                                    min={1}
                                    max={10}
                                    value={ticks}
                                    onChange={e => setTicks(Number(e.target.value))}
                                />
                            </div>
                            <div className='smart-trader__field'>
                                <label htmlFor='st-stake'>{localize('Stake')}</label>
                                <input
                                    id='st-stake'
                                    type='number'
                                    step='0.01'
                                    min={0.35}
                                    value={stake}
                                    onChange={e => setStake(Number(e.target.value))}
                                />
                            </div>
                            {needsPrediction && (
                                <div className='smart-trader__field'>
                                    <label htmlFor='st-pred'>{localize('Prediction digit')}</label>
                                    <input
                                        id='st-pred'
                                        type='number'
                                        min={0}
                                        max={9}
                                        value={prediction}
                                        onChange={e => setPrediction(Math.max(0, Math.min(9, Number(e.target.value))))}
                                    />
                                </div>
                            )}
                        </div>

                        <div className='smart-trader__actions'>
                            <button
                                className='smart-trader__run'
                                onClick={onRun}
                                disabled={is_running || !symbol}
                            >
                                {is_running ? localize('Processing...') : localize('Start Trading')}
                            </button>
                        </div>

                        {status && (
                            <div className='smart-trader__status'>
                                <Text size='xs' color={/error|fail/i.test(status) ? 'loss-danger' : 'prominent'}>
                                    {status}
                                </Text>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default SmartTrader;
