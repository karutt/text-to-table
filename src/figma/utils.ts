/**
 * Utility functions for Figma operations
 */
export class FigmaUtils {
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
     * Set node as selected
     */
    static selectNode(node: SceneNode): void {
        figma.currentPage.selection = [node];
    }

    /**
     * Get currently selected nodes
     */
    static getSelectedNodes(): readonly SceneNode[] {
        return figma.currentPage.selection;
    }

    /**
     * Get selected table (Frame)
     */
    static getSelectedTable(): FrameNode | null {
        const selection = figma.currentPage.selection;
        if (selection.length === 1 && selection[0].type === 'FRAME') {
            return selection[0] as FrameNode;
        }
        return null;
    }

    /**
     * Position node at specified coordinates
     */
    static positionNode(node: SceneNode, x: number, y: number): void {
        node.x = x;
        node.y = y;
    }
}
