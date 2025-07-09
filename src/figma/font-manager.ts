import type { TableConfig } from './table-builder';

/**
 * Font Manager for optimized font loading
 * Handles font preloading and caching to avoid repeated font loads
 */
export class FontManager {
    private static loadedFonts = new Set<string>();
    private static isInitialized = false;

    /**
     * Initialize font manager and preload common fonts
     * Should be called once when the plugin starts
     */
    static async initialize(config?: TableConfig): Promise<void> {
        if (this.isInitialized) {
            console.log('FontManager already initialized');
            return;
        }

        console.log('🔤 Initializing FontManager...');

        try {
            // Preload common fonts based on config or defaults
            const fontFamily = config?.fontFamily || 'Inter';
            await this.preloadCommonFonts(fontFamily);

            this.isInitialized = true;
            console.log('✅ FontManager initialized successfully');
        } catch (error) {
            console.error('❌ FontManager initialization failed:', error);
            // Don't throw - allow plugin to continue with basic functionality
        }
    }

    /**
     * Preload common fonts that are likely to be used
     */
    private static async preloadCommonFonts(fontFamily: string): Promise<void> {
        const fontsToLoad: Array<{ family: string; style: string; priority: number }> = [];

        // Use Set to avoid duplicates
        const fontSet = new Set<string>();

        // Add font to set if not already present
        const addFont = (family: string, style: string, priority: number) => {
            const fontKey = `${family}_${style}`;
            if (!fontSet.has(fontKey)) {
                fontSet.add(fontKey);
                fontsToLoad.push({ family, style, priority });
            }
        };

        // Priority fonts based on usage patterns
        // Regular fonts (most important)
        addFont(fontFamily, 'Regular', 1);

        // Bold fonts (for headers)
        addFont(fontFamily, 'Bold', 2);

        // Only add Inter fallback if the config font is not Inter
        if (fontFamily !== 'Inter') {
            addFont('Inter', 'Regular', 3);
            addFont('Inter', 'Bold', 4);
        }

        console.log(
            'Loading fonts in parallel:',
            fontsToLoad.map(f => `${f.family} ${f.style}`),
        );

        // Load fonts in parallel
        const fontPromises = fontsToLoad.map(async fontInfo => {
            const { family, style, priority } = fontInfo;
            const fontKey = `${family}_${style}`;

            try {
                await figma.loadFontAsync({ family, style });
                this.loadedFonts.add(fontKey);
                console.log(`✓ Font loaded: ${family} ${style} (priority: ${priority})`);
                return { fontInfo, success: true };
            } catch (error) {
                console.warn(`✗ Font failed: ${family} ${style} (priority: ${priority})`, error);
                return { fontInfo, success: false, error };
            }
        });

        // Execute all font loading in parallel
        const results = await Promise.allSettled(fontPromises);

        // Log results
        const successCount = results.filter(
            result => result.status === 'fulfilled' && result.value.success,
        ).length;
        const failedCount = results.length - successCount;

        console.log(`Font loading complete: ${successCount} succeeded, ${failedCount} failed`);

        // Validate critical fonts
        this.validateCriticalFonts(fontFamily);
    }

    /**
     * Ensure a specific font is loaded
     * Only loads if not already loaded
     */
    static async ensureFontLoaded(fontName: FontName): Promise<boolean> {
        const fontKey = `${fontName.family}_${fontName.style}`;

        // Return true if already loaded
        if (this.loadedFonts.has(fontKey)) {
            return true;
        }

        // Try to load the font
        try {
            await figma.loadFontAsync(fontName);
            this.loadedFonts.add(fontKey);
            console.log(`✓ Font loaded on demand: ${fontName.family} ${fontName.style}`);
            return true;
        } catch (error) {
            console.warn(`✗ Failed to load font: ${fontName.family} ${fontName.style}`, error);
            return false;
        }
    }

    /**
     * Check if a font is already loaded
     */
    static isFontLoaded(fontName: FontName): boolean {
        const fontKey = `${fontName.family}_${fontName.style}`;
        return this.loadedFonts.has(fontKey);
    }

    /**
     * Get the best available font for text rendering
     * Returns a loaded font that can be used immediately
     */
    static getBestAvailableFont(
        preferredFamily: string,
        isHeader: boolean,
        isBold?: boolean,
    ): FontName {
        const preferredStyle = isHeader || isBold ? 'Bold' : 'Regular';

        // Try preferred font first
        const preferredFont = { family: preferredFamily, style: preferredStyle };
        if (this.isFontLoaded(preferredFont)) {
            return preferredFont;
        }

        // Try preferred family with Regular style
        const preferredRegular = { family: preferredFamily, style: 'Regular' };
        if (this.isFontLoaded(preferredRegular)) {
            return preferredRegular;
        }

        // Fallback to Inter
        const interFont = { family: 'Inter', style: preferredStyle };
        if (this.isFontLoaded(interFont)) {
            return interFont;
        }

        const interRegular = { family: 'Inter', style: 'Regular' };
        if (this.isFontLoaded(interRegular)) {
            return interRegular;
        }

        // Final fallback - return something that should work
        console.warn('No loaded fonts found, using fallback');
        return { family: 'Inter', style: 'Regular' };
    }

    /**
     * Validate that critical fonts are available
     */
    private static validateCriticalFonts(fontFamily: string): void {
        const hasMainFont = this.isFontLoaded({ family: fontFamily, style: 'Regular' });

        if (!hasMainFont) {
            if (fontFamily === 'Inter') {
                console.warn('⚠️ Inter Regular font not available, using system default');
            } else {
                // Check if Inter fallback is available
                const hasInterFallback = this.isFontLoaded({ family: 'Inter', style: 'Regular' });
                if (hasInterFallback) {
                    console.warn(`⚠️ Main font ${fontFamily} not available, falling back to Inter`);
                } else {
                    console.warn(
                        `⚠️ Main font ${fontFamily} and Inter fallback not available, using system default`,
                    );
                }
            }
        }
    }

    /**
     * Get initialization status
     */
    static isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * Get loaded fonts info for debugging
     */
    static getLoadedFonts(): string[] {
        return Array.from(this.loadedFonts);
    }
}
