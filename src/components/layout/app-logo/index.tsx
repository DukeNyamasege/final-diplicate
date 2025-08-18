import { useDevice } from '@deriv-com/ui';
import { Tooltip } from '@deriv-com/ui';
import { LegacyMenuHamburger1pxIcon } from '@deriv/quill-icons/Legacy';
// Custom icons to match uploaded images exactly
import { useTranslations } from '@deriv-com/translations';
import './app-logo.scss';

// Custom WhatsApp Icon - using your uploaded image
const WhatsAppIcon = () => (
    <img
        src="/whatsapp icon.png"
        alt="WhatsApp"
        width="32"
        height="32"
        style={{ objectFit: 'contain' }}
    />
);

// Custom Refresh Icon - using your uploaded image
const RefreshIcon = () => (
    <img
        src="/refresh batton.png"
        alt="Refresh"
        width="32"
        height="32"
        style={{ objectFit: 'contain' }}
    />
);

// Menu Icon for mobile/tablet
const MenuIcon = ({ onClick }: { onClick: () => void }) => (
    <button
        className='app-header__menu-icon-button'
        onClick={onClick}
        type='button'
        aria-label='Open menu'
    >
        <LegacyMenuHamburger1pxIcon iconSize='sm' fill='var(--text-general)' />
    </button>
);

export const AppLogo = ({ onMenuClick }: { onMenuClick?: () => void }) => {
    const { isDesktop } = useDevice();
    const { localize } = useTranslations();

    // Header icons handlers
    const handleWhatsAppClick = () => {
        // Open WhatsApp or live chat
        const whatsappUrl = 'https://wa.me/35699578341'; // Deriv WhatsApp number
        window.open(whatsappUrl, '_blank');
    };

    const handleRefreshClick = () => {
        window.location.reload();
    };

    return (
        <div className='app-header__logo-container'>
            {/* On mobile/tablet: Menu icon takes the place of Deriv logo */}
            {!isDesktop && onMenuClick && (
                <MenuIcon onClick={onMenuClick} />
            )}

            {/* Custom icons - always visible on all devices */}
            <div className='app-header__logo-icons'>
                <Tooltip tooltipContent={localize('WhatsApp')}>
                    <button
                        className='app-header__logo-icon-button'
                        onClick={handleWhatsAppClick}
                        type='button'
                    >
                        <WhatsAppIcon />
                    </button>
                </Tooltip>
                <Tooltip tooltipContent={localize('Refresh page')}>
                    <button
                        className='app-header__logo-icon-button'
                        onClick={handleRefreshClick}
                        type='button'
                    >
                        <RefreshIcon />
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};
