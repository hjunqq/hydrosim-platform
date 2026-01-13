import React from 'react';
import Button from 'devextreme-react/button';
import { useTheme } from '../contexts/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <Button
            icon={theme === 'dark' ? 'sun' : 'moon'}
            stylingMode="text"
            hint={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
            onClick={toggleTheme}
            className="theme-toggle-btn"
        />
    );
};

export default ThemeToggle;
