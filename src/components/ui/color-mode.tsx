'use client';

import type { IconButtonProps, SpanProps } from '@chakra-ui/react';
import { ClientOnly, IconButton, Skeleton, Span } from '@chakra-ui/react';
import type { ThemeProviderProps } from 'next-themes';
import { ThemeProvider } from 'next-themes';
import * as React from 'react';
import { LuMoon, LuSun } from 'react-icons/lu';
import { useColorMode } from './useColorMode';

export type ColorModeProviderProps = ThemeProviderProps;

export function ColorModeProvider(props: ColorModeProviderProps) {
    return <ThemeProvider attribute="class" disableTransitionOnChange {...props} />;
}

export const ColorModeIcon = () => {
    const { colorMode } = useColorMode();
    return colorMode === 'dark' ? <LuMoon /> : <LuSun />;
};

export type ColorModeButtonProps = Omit<IconButtonProps, 'aria-label'>;

export const ColorModeButton = React.forwardRef<HTMLButtonElement, ColorModeButtonProps>(
    function ColorModeButton(props, ref) {
        const { toggleColorMode } = useColorMode();
        return (
            <ClientOnly fallback={<Skeleton boxSize="8" />}>
                <IconButton
                    ref={ref}
                    aria-label="Toggle color mode"
                    onClick={toggleColorMode}
                    size="sm"
                    variant="ghost"
                    {...props}
                    css={{
                        _icon: {
                            width: '5',
                            height: '5',
                        },
                    }}
                >
                    <ColorModeIcon />
                </IconButton>
            </ClientOnly>
        );
    },
);

export const LightMode = React.forwardRef<HTMLSpanElement, SpanProps>(
    function LightMode(props, ref) {
        return (
            <Span
                className="chakra-theme light"
                ref={ref}
                display="contents"
                color="fg"
                colorPalette="gray"
                colorScheme="light"
                {...props}
            />
        );
    },
);

export const DarkMode = React.forwardRef<HTMLSpanElement, SpanProps>(function DarkMode(props, ref) {
    return (
        <Span
            className="chakra-theme dark"
            ref={ref}
            display="contents"
            color="fg"
            colorPalette="gray"
            colorScheme="dark"
            {...props}
        />
    );
});
