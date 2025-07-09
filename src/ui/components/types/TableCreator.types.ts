import type {
    CreateTableRequest,
    CreateTableResponse,
    CreateTablesRequest,
    CreateTablesResponse,
} from '../../../figma/controller';
import type { SupportedFormat } from '../../../parsers';

export interface TableCreatorProps {
    onCreateTable: (request: CreateTableRequest) => Promise<CreateTableResponse>;
    onCreateTables: (request: CreateTablesRequest) => Promise<CreateTablesResponse>;
    onCreateTablesFromMarkdown?: (request: CreateTableRequest) => Promise<CreateTablesResponse>;
    isLoading?: boolean;
}

export interface UploadedFile {
    filename: string;
    content: string;
    format: SupportedFormat;
}

export interface TableCreatorState {
    text: string;
    format: SupportedFormat;
    uploadedFiles: UploadedFile[];
    activeTab: 'upload' | 'manual' | 'editor';
    autoDetectionTimeout: NodeJS.Timeout | null;
}
