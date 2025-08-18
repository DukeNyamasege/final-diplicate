import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import Button from '@/components/shared_ui/button';
import Text from '@/components/shared_ui/text';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { load } from '@/external/bot-skeleton/scratch/utils';
import { save_types } from '@/external/bot-skeleton/constants/save-type';
import DBotStore from '@/external/bot-skeleton/scratch/dbot-store';
import './free-bots.scss';

interface BotData {
    name: string;
    description: string;
    difficulty: string;
    strategy: string;
    features: string[];
    xml: string;
}

const FreeBots = observer(() => {
    const { dashboard, app } = useStore();
    const { active_tab, setActiveTab, setPendingFreeBot } = dashboard;
    const [availableBots, setAvailableBots] = useState<BotData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Simple bot configuration for localhost
    const getXmlFiles = () => {
        return [
            '$DollarprinterbotOrignal$.xml',
            '360 PRINTER BOT____ [ Version 2.2 ].xml',
            'Candle-Mine Version 2  (2).xml',
            'DIFFERS KILLER BOT.xml',
            'DOLLAR  HUNTER BOT ORIGINAL UPDATED.xml',
            'Legoo-sniper-bot.xml',
            'MKOREAN SV6 BOT (1).xml',
            'Marvel PRO Fully Auto V 2.0  [Original] by {www.360tradinghub.co.ke}.xml',
            'Marvel SPLIT Version by 360 Trading Hub.xml',
            "Mathews' speed bot.xml",
            'Printed_dollars_Bot.xml',
            'TC Bot 1.1.xml',
            'legoospeedbot.xml',
        ];
    };

    // Wait for workspace to be available
    const waitForWorkspace = (maxAttempts = 10, delay = 500) => {
        return new Promise((resolve, reject) => {
            let attempts = 0;

            const checkWorkspace = () => {
                attempts++;
                if (window.Blockly?.derivWorkspace) {
                    console.log('Workspace is ready!');
                    resolve(window.Blockly.derivWorkspace);
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Workspace not available after maximum attempts'));
                } else {
                    console.log(`Waiting for workspace... attempt ${attempts}/${maxAttempts}`);
                    setTimeout(checkWorkspace, delay);
                }
            };

            checkWorkspace();
        });
    };

    // Load bot into builder
    const loadBotIntoBuilder = async (bot: BotData) => {
        try {
            if (bot.xml) {
                console.log('Loading bot:', bot.name);
                console.log('Blockly workspace available:', !!window.Blockly?.derivWorkspace);

                // Flag the selected bot for the Bot Builder to load after navigation
                setPendingFreeBot({ name: bot.name, xml: bot.xml });

                // Navigate to Bot Builder; loading will be handled when workspace is ready
                setActiveTab(DBOT_TABS.BOT_BUILDER);

                console.log('Navigating to Bot Builder to load bot:', bot.name);
            }
        } catch (error) {
            console.error('Error loading bot:', error);
        }
    };

    // Load bots from XML files
    useEffect(() => {
        const loadBots = async () => {
            if (active_tab !== DBOT_TABS.FREE_BOTS) return;

            setIsLoading(true);
            setError(null);

            try {
                const xmlFiles = getXmlFiles();
                const bots: BotData[] = [];

                console.log(`Loading ${xmlFiles.length} bot files...`);

                for (const fileName of xmlFiles) {
                    try {
                        const url = `/xml/${encodeURIComponent(fileName)}`;
                        console.log(`Attempting to fetch: ${url}`);
                        const response = await fetch(url);

                        if (response.ok) {
                            const xmlContent = await response.text();
                            console.log(`✓ Successfully loaded ${fileName}, content length: ${xmlContent.length}`);

                            // Extract bot name from filename
                            const botName = fileName.replace('.xml', '').replace(/[_-]/g, ' ');

                            bots.push({
                                name: botName,
                                description: `Advanced trading bot: ${botName}`,
                                difficulty: 'Intermediate',
                                strategy: 'Multi-Strategy',
                                features: ['Automated Trading', 'Risk Management', 'Profit Optimization'],
                                xml: xmlContent,
                            });

                            console.log(`✓ Added bot to list: ${botName}`);
                        } else {
                            console.warn(`Failed to load: ${fileName} (${response.status} ${response.statusText})`);
                        }
                    } catch (fileError) {
                        console.error(`Error loading ${fileName}:`, fileError);
                    }
                }

                setAvailableBots(bots);
                console.log(`Successfully loaded ${bots.length} bots`);
            } catch (error) {
                console.error('Error loading bots:', error);
                setError('Failed to load bots. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        loadBots();
    }, [active_tab]);

    return (
        <div className='free-bots'>
            <div className='free-bots__container'>
                {isLoading ? (
                    <div className='free-bots__loading'>
                        <Text size='s' color='general'>
                            {localize('Loading free bots...')}
                        </Text>
                    </div>
                ) : error ? (
                    <div className='free-bots__error'>
                        <Text size='s' color='general'>
                            {error}
                        </Text>
                        <div style={{ marginTop: '20px' }}>
                            <Button onClick={() => window.location.reload()}>{localize('Retry')}</Button>
                        </div>
                    </div>
                ) : availableBots.length === 0 ? (
                    <div className='free-bots__empty'>
                        <Text size='s' color='general'>
                            {localize('No bots available at the moment.')}
                        </Text>
                    </div>
                ) : (
                    <div className='free-bots__grid'>
                        {availableBots.map((bot, index) => (
                            <div key={index} className='free-bot-card'>
                                <div className='free-bot-card__header'>
                                    <Text size='s' weight='bold' className='free-bot-card__title'>
                                        {bot.name}
                                    </Text>
                                    <div className='free-bot-card__badges'>
                                        <span className='free-bot-card__badge free-bot-card__badge--difficulty'>
                                            {bot.difficulty}
                                        </span>
                                        <span className='free-bot-card__badge free-bot-card__badge--strategy'>
                                            {bot.strategy}
                                        </span>
                                    </div>
                                </div>

                                <Text size='xs' color='general' className='free-bot-card__description'>
                                    {bot.description}
                                </Text>

                                <div className='free-bot-card__features'>
                                    {bot.features.map((feature, featureIndex) => (
                                        <span key={featureIndex} className='free-bot-card__feature'>
                                            {feature}
                                        </span>
                                    ))}
                                </div>

                                <Button
                                    className='free-bot-card__load-btn'
                                    onClick={() => loadBotIntoBuilder(bot)}
                                    primary
                                    has_effect
                                    type='button'
                                >
                                    {localize('Load Bot')}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});

export default FreeBots;
