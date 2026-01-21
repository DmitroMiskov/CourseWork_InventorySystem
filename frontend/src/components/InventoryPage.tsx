import { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import CategoryIcon from '@mui/icons-material/Category';

// Імпортуємо ваші компоненти
import ProductList from './ProductList';
import CategoryList from './CategoryList';

interface InventoryPageProps {
    isAdmin?: boolean; // Передаємо роль, якщо є
}

export default function InventoryPage({ isAdmin = true }: InventoryPageProps) {
    const [tabIndex, setTabIndex] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
    };

    return (
        <Box sx={{ width: '100%' }}>
            {/*  - conceptual visualization */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={tabIndex} onChange={handleTabChange} aria-label="inventory tabs">
                    <Tab icon={<Inventory2Icon />} iconPosition="start" label="Товари" />
                    <Tab icon={<CategoryIcon />} iconPosition="start" label="Категорії" />
                </Tabs>
            </Box>

            {/* Вкладка 0: Товари */}
            <div role="tabpanel" hidden={tabIndex !== 0}>
                {tabIndex === 0 && (
                    <ProductList isAdmin={isAdmin} />
                )}
            </div>

            {/* Вкладка 1: Категорії */}
            <div role="tabpanel" hidden={tabIndex !== 1}>
                {tabIndex === 1 && (
                    <CategoryList isAdmin={isAdmin} />
                )}
            </div>
        </Box>
    );
}