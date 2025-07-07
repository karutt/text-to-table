import type { SupportedFormat } from '../../../parsers';

export const getPlaceholderText = (format: SupportedFormat): string => {
    switch (format) {
        case 'csv':
            return 'Name,Age,City\nJohn,25,Tokyo\nJane,30,Osaka';
        case 'tsv':
            return 'Name\tAge\tCity\nJohn\t25\tTokyo\nJane\t30\tOsaka';
        case 'markdown':
            return `| Name | Age | City |\n|------|-----|------|\n| John | 25  | Tokyo |\n| Jane | 30  | Osaka |`;
        default:
            return 'Name,Age,City\nJohn,25,Tokyo\nJane,30,Osaka';
    }
};
