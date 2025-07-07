import { Box, Text, VStack } from '@chakra-ui/react';
import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';

interface ErrorDisplayProps {
    errors: string[];
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ errors }) => {
    if (errors.length === 0) return null;

    return (
        <Box p={4} bg="red.50" borderColor="red.500" borderLeft="4px solid" borderRadius="md">
            <VStack align="start" gap={2}>
                <Text
                    alignItems="center"
                    gap={2}
                    display="flex"
                    color="red.700"
                    fontWeight="semibold"
                >
                    <FiAlertCircle />
                    Error
                </Text>
                {errors.map((error, index) => (
                    <Text key={index} color="red.600" fontSize="sm">
                        • {error}
                    </Text>
                ))}
            </VStack>
        </Box>
    );
};
