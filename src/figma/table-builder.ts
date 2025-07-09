import type { CellFormat, ColumnAlignment } from '../parsers/markdown-parser';
import { FontManager } from './font-manager';

export interface TableConfig {
    cellPadding: number;
    borderWidth: number;
    borderColor: RGB;
    backgroundColor: RGB;
    headerBackgroundColor?: RGB;
    fontSize: number;
    fontFamily: string;
    fontWeight: number;
    textColor: RGB;
    headerTextColor?: RGB;
    minCellWidth: number;
    minCellHeight: number;
}

export interface TableBuildOptions {
    config: TableConfig;
    alignments?: ColumnAlignment[];
    hasHeader?: boolean;
    autoFitColumns?: boolean; // New option: Auto-adjust column width to fit content
    progressiveRendering?: boolean; // New option: Progressive rendering for large tables
    batchSize?: number; // Batch size (default 50 rows)
}

export const DEFAULT_TABLE_CONFIG: TableConfig = {
    cellPadding: 12,
    borderWidth: 1,
    borderColor: { r: 0.8, g: 0.8, b: 0.8 },
    backgroundColor: { r: 1, g: 1, b: 1 },
    headerBackgroundColor: { r: 0.95, g: 0.95, b: 0.95 },
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: 400,
    textColor: { r: 0.1, g: 0.1, b: 0.1 },
    headerTextColor: { r: 0.05, g: 0.05, b: 0.05 },
    minCellWidth: 80,
    minCellHeight: 36,
};

/**
 * Figma table builder using Frame-based approach
 * Uses Frame and Auto Layout since native Table API is only available in FigJam
 */
export class FigmaTableBuilder {
    private config: TableConfig;

    constructor(config: TableConfig = DEFAULT_TABLE_CONFIG) {
        this.config = config;
    }

    /**
     * Build Figma table from table data (Progressive rendering compatible)
     */
    async buildTable(
        data: string[][],
        options: Partial<TableBuildOptions> = {},
        cellFormats?: CellFormat[][],
    ): Promise<FrameNode> {
        // Determine progressive rendering based on cell count (more practical)
        const totalCells = data.length * (data[0]?.length || 1);
        const shouldUseProgressive = totalCells > 200 || data.length > 50; // Enabled at 200 cells or 50 rows

        if (data.length === 0) {
            throw new Error('Table data is empty');
        }

        console.log(
            `📊 Table analysis: ${data.length} rows × ${data[0]?.length || 0} cols = ${totalCells} cells`,
        );

        // Use progressive rendering for large tables
        if (shouldUseProgressive) {
            return this.buildTableProgressive(data, options, cellFormats);
        }

        // Normal batch processing
        return this.buildTableBatch(data, options, cellFormats);
    }

    /**
     * Progressive rendering (for large tables)
     */
    private async buildTableProgressive(
        data: string[][],
        options: Partial<TableBuildOptions> = {},
        cellFormats?: CellFormat[][],
    ): Promise<FrameNode> {
        const { alignments, hasHeader = false } = options;
        const config = { ...this.config, ...options.config };

        // Dynamic batch size adjustment based on cell count
        const totalCells = data.length * (data[0]?.length || 1);
        let dynamicBatchSize: number;

        if (totalCells > 2000) {
            dynamicBatchSize = 15; // Large capacity: 15 rows/batch
        } else if (totalCells >= 1000) {
            // Change to >=
            dynamicBatchSize = 25; // Medium capacity: 25 rows/batch
        } else if (totalCells >= 500) {
            // Add new intermediate level
            dynamicBatchSize = 30; // Medium-small capacity: 30 rows/batch
        } else {
            dynamicBatchSize = 40; // Small capacity: 40 rows/batch
        }

        const batchSize = options.batchSize || dynamicBatchSize;

        console.log(
            `🔄 Progressive rendering: ${data.length} rows × ${data[0]?.length || 0} cols (${totalCells} cells)`,
        );

        // FontManager handles font loading - no need to preload here
        if (!FontManager.isReady()) {
            console.warn('FontManager not ready, initializing...');
            await FontManager.initialize(config);
        }

        // Create main table container
        const tableFrame = figma.createFrame();
        tableFrame.name = 'Table (Progressive)';
        this.setupTableFrame(tableFrame, data, config);

        // Create and add rows in batches
        for (let batchStart = 0; batchStart < data.length; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize, data.length);
            const batchData = data.slice(batchStart, batchEnd);

            console.log(
                `Creating batch ${Math.floor(batchStart / batchSize) + 1}: rows ${batchStart + 1}-${batchEnd}`,
            );

            // Create rows in parallel within the batch
            const rowPromises = batchData.map(async (rowData, index) => {
                const actualRowIndex = batchStart + index;
                const isHeaderRow = hasHeader && actualRowIndex === 0;
                const rowFormats = cellFormats?.[actualRowIndex];
                return this.createRow(
                    rowData,
                    actualRowIndex,
                    isHeaderRow,
                    alignments,
                    config,
                    rowFormats,
                );
            });

            const batchRows = await Promise.all(rowPromises);

            // Add batch to table (optimized: set layout outside loop)
            batchRows.forEach(rowFrame => {
                tableFrame.appendChild(rowFrame);
            });

            // Execute layout settings in bulk (DOM update optimization)
            batchRows.forEach(rowFrame => {
                rowFrame.layoutSizingHorizontal = 'FILL';
                rowFrame.layoutSizingVertical = 'HUG';
            });

            // Wait for UI responsiveness (further reduced: 2ms → 1ms)
            if (batchEnd < data.length) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        this.adjustTableSize(tableFrame);

        return tableFrame;
    }

    /**
     * Normal batch processing (optimized version)
     */
    private async buildTableBatch(
        data: string[][],
        options: Partial<TableBuildOptions> = {},
        cellFormats?: CellFormat[][],
    ): Promise<FrameNode> {
        const { alignments, hasHeader = false } = options;
        const config = { ...this.config, ...options.config };

        // FontManager handles font loading - no need to preload here
        if (!FontManager.isReady()) {
            console.warn('FontManager not ready, initializing...');
            await FontManager.initialize(config);
        }

        // Create main table container
        const tableFrame = figma.createFrame();
        tableFrame.name = 'Table';
        this.setupTableFrame(tableFrame, data, config);

        // Batch processing: create all rows in parallel
        const rowCreationPromises = data.map(async (rowData, rowIndex) => {
            const isHeaderRow = hasHeader && rowIndex === 0;
            const rowFormats = cellFormats?.[rowIndex];
            return this.createRow(rowData, rowIndex, isHeaderRow, alignments, config, rowFormats);
        });

        // Create all rows in parallel
        const rows = await Promise.all(rowCreationPromises);

        // Add created rows to table in bulk (DOM batch update optimization)

        // Step 1: Add all rows to DOM
        rows.forEach(rowFrame => {
            tableFrame.appendChild(rowFrame);
        });

        // Step 2: Execute layout settings in bulk (minimize DOM recalculation)
        rows.forEach(rowFrame => {
            rowFrame.layoutSizingHorizontal = 'FILL'; // width = fill (match parent table width)
            rowFrame.layoutSizingVertical = 'HUG'; // height = hug (adjust height to content)
        });

        // Adjust table size
        this.adjustTableSize(tableFrame);

        return tableFrame;
    }

    /**
     * Basic table frame setup (common process)
     */
    private setupTableFrame(tableFrame: FrameNode, data: string[][], config: TableConfig): void {
        tableFrame.layoutMode = 'VERTICAL';
        tableFrame.itemSpacing = 0;
        tableFrame.paddingLeft = 0;
        tableFrame.paddingRight = 0;
        tableFrame.paddingTop = 0;
        tableFrame.paddingBottom = 0;
        tableFrame.fills = [{ type: 'SOLID', color: config.backgroundColor }];
        tableFrame.cornerRadius = 4;
        tableFrame.clipsContent = true;

        // Table Auto Layout settings: width = column count × 100, height = hug
        const columnCount = data[0]?.length || 1;
        const tableWidth = columnCount * 100;
        tableFrame.layoutSizingHorizontal = 'FIXED'; // width = fixed
        tableFrame.layoutSizingVertical = 'HUG'; // height = hug
        tableFrame.resize(tableWidth, 100); // Set width (height will be adjusted by Auto Layout later)
    }

    /**
     * Create table row (optimized version)
     */
    private async createRow(
        rowData: string[],
        rowIndex: number,
        isHeader: boolean,
        alignments?: ColumnAlignment[],
        config: TableConfig = this.config,
        rowFormats?: CellFormat[],
    ): Promise<FrameNode> {
        const rowFrame = figma.createFrame();
        rowFrame.name = `Row ${rowIndex + 1}${isHeader ? ' (Header)' : ''}`;
        rowFrame.layoutMode = 'HORIZONTAL';
        rowFrame.itemSpacing = 0;
        rowFrame.paddingLeft = 0;
        rowFrame.paddingRight = 0;
        rowFrame.paddingTop = 0;
        rowFrame.paddingBottom = 0;
        rowFrame.fills = [];

        // Batch process: create cells in parallel
        const cellCreationPromises = rowData.map(async (cellText, cellIndex) => {
            const alignment = alignments?.[cellIndex] || 'left';
            const cellFormat = rowFormats?.[cellIndex];
            return this.createCell(
                cellText,
                cellIndex,
                rowIndex,
                isHeader,
                alignment,
                config,
                cellFormat,
            );
        });

        // Create all cells in parallel
        const cells = await Promise.all(cellCreationPromises);

        // Add created cells to row in bulk (DOM operation optimization)
        // Step 1: Add all cells to DOM
        cells.forEach(cellFrame => {
            rowFrame.appendChild(cellFrame);
        });

        // Step 2: Execute layout settings in bulk
        cells.forEach(cellFrame => {
            cellFrame.layoutSizingHorizontal = 'FILL'; // width = fill (evenly distributed within row)
            cellFrame.layoutSizingVertical = 'FILL'; // height = hug
        });

        return rowFrame;
    }

    /**
     * Create table cell
     */
    private async createCell(
        text: string,
        cellIndex: number,
        rowIndex: number,
        isHeader: boolean,
        alignment: ColumnAlignment,
        config: TableConfig,
        cellFormat?: CellFormat,
    ): Promise<FrameNode> {
        const cellFrame = figma.createFrame();
        cellFrame.name = `Cell ${rowIndex + 1}-${cellIndex + 1}`;
        cellFrame.layoutMode = 'VERTICAL';
        cellFrame.primaryAxisAlignItems = 'CENTER'; // align vertically center

        // Horizontal alignment settings
        switch (alignment) {
            case 'center':
                cellFrame.counterAxisAlignItems = 'CENTER';
                break;
            case 'right':
                cellFrame.counterAxisAlignItems = 'MAX';
                break;
            default: // 'left'
                cellFrame.counterAxisAlignItems = 'MIN';
                break;
        }

        cellFrame.paddingLeft = config.cellPadding;
        cellFrame.paddingRight = config.cellPadding;
        cellFrame.paddingTop = config.cellPadding / 2;
        cellFrame.paddingBottom = config.cellPadding / 2;

        // Cell background color
        const backgroundColor =
            isHeader && config.headerBackgroundColor
                ? config.headerBackgroundColor
                : config.backgroundColor;

        cellFrame.fills = [{ type: 'SOLID', color: backgroundColor }];

        // Border settings
        cellFrame.strokes = [{ type: 'SOLID', color: config.borderColor }];
        cellFrame.strokeWeight = config.borderWidth;
        cellFrame.strokeAlign = 'CENTER'; // Set border alignment to center

        // Cell Auto Layout settings are set after adding to parent (Row)
        // width = fill (evenly distributed within row), height = hug

        // Create text node
        if (text.trim()) {
            const textNode = await this.createTextNode(text, isHeader, config, cellFormat);
            cellFrame.appendChild(textNode);

            // Set layoutSizing after adding as Auto Layout child element
            textNode.layoutSizingHorizontal = 'FILL'; // width = fill (fill parent cell)
            textNode.layoutSizingVertical = 'HUG'; // height = hug (adjust to content)
        }

        return cellFrame;
    }

    /**
     * Create text node (optimized version - robust fallback process)
     */
    private async createTextNode(
        text: string,
        isHeader: boolean,
        config: TableConfig,
        cellFormat?: CellFormat,
    ): Promise<TextNode> {
        const textNode = figma.createText();

        // Use FontManager to get the best available font based on formatting
        const isBold = cellFormat?.isBold || false;
        const bestFont = FontManager.getBestAvailableFont(config.fontFamily, isHeader, isBold);

        try {
            // Ensure the font is loaded (should be already loaded via FontManager)
            await FontManager.ensureFontLoaded(bestFont);
            textNode.fontName = bestFont;
        } catch (error) {
            console.warn(
                `Failed to set font ${bestFont.family} ${bestFont.style}, using fallback:`,
                error,
            );

            // Final fallback to Inter Regular
            try {
                const fallbackFont = { family: 'Inter', style: 'Regular' };
                await FontManager.ensureFontLoaded(fallbackFont);
                textNode.fontName = fallbackFont;
            } catch (fallbackError) {
                console.error('Even Inter Regular failed, using system default:', fallbackError);
                // System will assign some font
            }
        }

        textNode.characters = text;
        textNode.fontSize = config.fontSize;

        // Text color
        const textColor =
            isHeader && config.headerTextColor ? config.headerTextColor : config.textColor;

        textNode.fills = [{ type: 'SOLID', color: textColor }];

        // Automatic text resizing
        textNode.textAutoResize = 'WIDTH_AND_HEIGHT';

        return textNode;
    }

    /**
     * Adjust the overall size of the table
     */
    private adjustTableSize(tableFrame: FrameNode): void {
        // The table width is already set to column count × 100
        // The height is automatically adjusted by Auto Layout

        // Add drop shadow to the entire table (optional)
        tableFrame.effects = [
            {
                type: 'DROP_SHADOW',
                color: { r: 0, g: 0, b: 0, a: 0.1 },
                offset: { x: 0, y: 2 },
                radius: 4,
                spread: 0,
                visible: true,
                blendMode: 'NORMAL',
            },
        ];
    }

    /**
     * Update settings
     */
    updateConfig(newConfig: Partial<TableConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current settings
     */
    getConfig(): TableConfig {
        return { ...this.config };
    }
}
