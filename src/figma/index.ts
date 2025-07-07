export { FontManager } from './font-manager';
export {
    DEFAULT_TABLE_CONFIG,
    FigmaTableBuilder,
    type TableBuildOptions,
    type TableConfig,
} from './table-builder';

// Note: TableController is exported directly from ./controller to avoid circular dependencies

/**
 * Figma-related utility functions
 */
export class FigmaUtils {
    /**
     * Get currently selected nodes
     */
    static getSelection(): readonly SceneNode[] {
        return figma.currentPage.selection;
    }

    /**
     * Position node at specified coordinates
     */
    static positionNode(node: SceneNode, x: number, y: number): void {
        node.x = x;
        node.y = y;
    }

    /**
     * Get viewport center coordinates
     */
    static getViewportCenter(): { x: number; y: number } {
        const viewport = figma.viewport;
        return {
            x: viewport.center.x,
            y: viewport.center.y,
        };
    }

    /**
     * Clear selection
     */
    static clearSelection(): void {
        figma.currentPage.selection = [];
    }

    /**
     * Select node
     */
    static selectNode(node: SceneNode): void {
        figma.currentPage.selection = [node];
    }

    /**
     * Zoom viewport to fit node
     */
    static zoomToNode(node: SceneNode): void {
        figma.viewport.scrollAndZoomIntoView([node]);
    }

    /**
     * Get available font families
     */
    static async getAvailableFonts(): Promise<Font[]> {
        return figma.listAvailableFontsAsync();
    }

    /**
     * Check if font is available
     */
    static async isFontAvailable(fontName: FontName): Promise<boolean> {
        try {
            await figma.loadFontAsync(fontName);
            return true;
        } catch {
            return false;
        }
    }
}
