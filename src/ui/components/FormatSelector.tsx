import { Box, HStack, RadioGroup, Text } from '@chakra-ui/react';
import React from 'react';
import { FiColumns, FiHash, FiTable } from 'react-icons/fi';

import type { SupportedFormat } from '../../parsers';

interface FormatSelectorProps {
    value: SupportedFormat;
    onChange: (format: SupportedFormat) => void;
}

const formatOptions = [
    {
        value: 'csv' as const,
        label: 'CSV',
        description: '',
        icon: FiColumns,
    },
    {
        value: 'tsv' as const,
        label: 'TSV',
        description: '',
        icon: FiTable,
    },
    {
        value: 'markdown' as const,
        label: 'Markdown',
        description: '',
        icon: FiHash,
    },
];

export const FormatSelector: React.FC<FormatSelectorProps> = ({ value, onChange }) => {
    return (
        <Box>
            <Text mb={3} fontSize="md" fontWeight="semibold">
                Data Format
            </Text>

            <RadioGroup.Root
                value={value}
                onValueChange={details => onChange(details.value as SupportedFormat)}
            >
                <HStack gap={4}>
                    {formatOptions.map(option => (
                        <RadioGroup.Item
                            key={option.value}
                            value={option.value}
                            flex={1}
                            cursor="pointer"
                            _hover={{ color: 'blue.fg' }}
                        >
                            <RadioGroup.ItemHiddenInput />
                            <HStack align="center" gap={2}>
                                <RadioGroup.ItemIndicator />
                                <option.icon />
                                <Box>
                                    <RadioGroup.ItemText fontWeight="medium">
                                        {option.label}
                                    </RadioGroup.ItemText>
                                    <Text color="gray.600" fontSize="sm">
                                        {option.description}
                                    </Text>
                                </Box>
                            </HStack>
                        </RadioGroup.Item>
                    ))}
                </HStack>
            </RadioGroup.Root>
        </Box>
    );
};
