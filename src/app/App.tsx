import { Box } from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import type {
    CreateTableRequest,
    CreateTableResponse,
    CreateTablesRequest,
    CreateTablesResponse,
} from '../figma/controller';
import { TableCreator } from '../ui/components/TableCreator';

interface PluginMessage {
    type: string;
    payload?: unknown;
}

function App() {
    const [isLoading, setIsLoading] = useState(false);

    const handleMessage = useCallback((event: MessageEvent) => {
        if (event.origin !== 'https://www.figma.com') return;

        const msg = event.data.pluginMessage as PluginMessage;
        if (msg) {
            setIsLoading(false);
            // Handle plugin responses here if needed
        }
    }, []);

    useEffect(() => {
        window.onmessage = handleMessage;

        return () => {
            window.onmessage = null;
        };
    }, [handleMessage]);

    const sendMessage = useCallback((type: string, data?: unknown) => {
        parent.postMessage(
            {
                pluginMessage: { type, data },
                pluginId: '*',
            },
            '*',
        );
    }, []);

    const handleCreateTable = useCallback(
        async (request: CreateTableRequest): Promise<CreateTableResponse> => {
            return new Promise(resolve => {
                setIsLoading(true);

                const originalHandler = window.onmessage;
                const responseHandler = (event: MessageEvent) => {
                    const { type, data } = event.data.pluginMessage;
                    if (type === 'create-table-response') {
                        setIsLoading(false);
                        window.onmessage = originalHandler;
                        resolve(data);
                    } else if (originalHandler) {
                        originalHandler.call(window, event);
                    }
                };

                window.onmessage = responseHandler;
                sendMessage('create-table', request);
            });
        },
        [sendMessage],
    );

    const handleCreateTables = useCallback(
        async (request: CreateTablesRequest): Promise<CreateTablesResponse> => {
            return new Promise(resolve => {
                setIsLoading(true);

                const originalHandler = window.onmessage;
                const responseHandler = (event: MessageEvent) => {
                    const { type, data } = event.data.pluginMessage;
                    if (type === 'create-tables-response') {
                        setIsLoading(false);
                        window.onmessage = originalHandler;
                        resolve(data);
                    } else if (originalHandler) {
                        originalHandler.call(window, event);
                    }
                };

                window.onmessage = responseHandler;
                sendMessage('create-tables', request);
            });
        },
        [sendMessage],
    );

    const handleCreateTablesFromMarkdown = useCallback(
        async (request: CreateTableRequest): Promise<CreateTablesResponse> => {
            return new Promise(resolve => {
                setIsLoading(true);

                const originalHandler = window.onmessage;
                const responseHandler = (event: MessageEvent) => {
                    const { type, data } = event.data.pluginMessage;
                    if (type === 'create-tables-from-markdown-response') {
                        setIsLoading(false);
                        window.onmessage = originalHandler;
                        resolve(data);
                    } else if (originalHandler) {
                        originalHandler.call(window, event);
                    }
                };

                window.onmessage = responseHandler;
                sendMessage('create-tables-from-markdown', request);
            });
        },
        [sendMessage],
    );

    return (
        <Box minH="100vh" p={4}>
            <TableCreator
                onCreateTable={handleCreateTable}
                onCreateTables={handleCreateTables}
                onCreateTablesFromMarkdown={handleCreateTablesFromMarkdown}
                isLoading={isLoading}
            />
        </Box>
    );
}

export default App;
