import { toaster } from '../../../components/ui/toaster-instance';

/**
 * Toast helper functions for displaying messages
 */
export const useToastHelpers = () => {
    const showError = (message: string) => {
        toaster.create({
            title: 'Error',
            description: message,
            type: 'error',
            duration: 5000,
        });
    };

    const showErrors = (errors: string[]) => {
        errors.forEach(error => {
            toaster.create({
                title: 'Error',
                description: error,
                type: 'error',
                duration: 5000,
            });
        });
    };

    const showSuccess = (title: string, description: string, duration = 3000) => {
        toaster.create({
            title,
            description,
            type: 'success',
            duration,
        });
    };

    return {
        showError,
        showErrors,
        showSuccess,
    };
};
