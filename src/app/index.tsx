import { Provider } from '@/components/ui/provider';
import '@/styles/globals.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider>
            <App />
        </Provider>
    </StrictMode>,
);
