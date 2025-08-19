import { useDevice } from '@deriv-com/ui';

import { LegacyMenuHamburger1pxIcon } from '@deriv/quill-icons/Legacy';
// Custom icons to match uploaded images exactly
import { useTranslations } from '@deriv-com/translations';
import './app-logo.scss';



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


        </div>
    );
};
