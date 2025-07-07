# Text to Table - Figma Plugin

A high-performance Figma plugin that converts text data (CSV, TSV, Markdown tables) into beautiful, styled tables directly in your Figma designs.

<!-- ![Text to Table Demo GIF](placeholder.gif) -->
<!-- TODO: Add a GIF demonstrating the plugin in action -->

## Table of Contents

- [✨ Key Features](#-key-features)
- [🚀 Getting Started](#-getting-started)
- [Usage](#usage)
- [Supported Formats](#supported-formats)
- [🛠️ For Developers](#️-for-developers)
- [🐛 Troubleshooting](#-troubleshooting)
- [📝 License](#-license)
- [🔗 Resources](#-resources)

## ✨ Key Features

- **Multiple Format Support**: Seamlessly convert CSV, TSV, and Markdown table data.
- **High Performance**: Optimized for large datasets with progressive rendering and dynamic batch sizing. Handles tables with 1000+ cells in seconds.
- **Smart Styling**:
    - Columns automatically adjust to content width.
    - Professional typography using system fonts with fallbacks (Inter → Roboto → Arial).
    - Consistent padding and margins for excellent readability.
- **Real-time Preview**: See a live preview of your table before creating it in Figma.
- **File Upload**: Easily upload `.csv`, `.tsv`, `.md`, or `.txt` files.
- **Clear Error Handling**: Get straightforward validation and error messages to quickly fix data formatting issues.

## 🚀 Getting Started

### Prerequisites

- [Figma Desktop App](https://www.figma.com/downloads/)
- [Node.js](https://nodejs.org/) (v18 or later)
- [pnpm](https://pnpm.io/installation)

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/text-to-table.git
    cd text-to-table
    ```

2.  **Install dependencies:**
    ```sh
    pnpm install
    ```

3.  **Build the plugin:**
    ```sh
    pnpm build
    ```

4.  **Load into Figma:**
    - Open the Figma desktop app.
    - Go to **Plugins** > **Development** > **Import plugin from manifest...**
    - Select the `manifest.json` file from the project's root directory.

## Usage

1.  Run the "Text to Table" plugin from Figma's plugin menu.
2.  **Upload a file**:
    - Drag and drop a CSV, TSV, or Markdown file onto the plugin window.
    - The plugin automatically detects the format.
3.  **Or, paste data manually**:
    - Select the data format (CSV, TSV, or Markdown).
    - Paste your data into the text area.
4.  Click **"Create Table"** to generate the table on your Figma canvas.

## Supported Formats

The plugin supports the following plain text formats.

> **CSV (Comma-Separated Values)**
> ```csv
> Name,Age,City
> John,25,Tokyo
> Jane,30,Osaka
> ```

> **TSV (Tab-Separated Values)**
> ```tsv
> Name	Age	City
> John	25	Tokyo
> Jane	30	Osaka
> ```

> **Markdown Tables**
> ```markdown
> | Name | Age | City |
> |------|-----|------|
> | John | 25  | Tokyo |
> | Jane | 30  | Osaka |
> ```

## 🛠️ For Developers

### Development Mode

To watch for file changes and enable hot reloading in Figma:
```sh
pnpm dev
```
The development server will start at `http://localhost:5173`.

### Code Quality

Run linting and formatting checks to maintain code consistency.
```sh
# Run linting
pnpm lint

# Automatically fix linting issues
pnpm lint:fix

# Format code with Prettier
pnpm format
```

### Project Structure
```
src/
├── app/            # React UI components
├── components/     # Reusable UI components
├── figma/          # Figma API integration & plugin logic
├── parsers/        # Data format parsing logic
├── plugin/         # Plugin message handling
├── types/          # TypeScript type definitions
└── ui/             # UI-specific components
```

### Contributing

Contributions are welcome!

1.  Fork the repository.
2.  Create a feature branch: `git checkout -b feature/new-feature`
3.  Make your changes.
4.  Ensure all checks pass: `pnpm lint && pnpm build`
5.  Submit a pull request.

## 🐛 Troubleshooting

- **"Invalid format" error**: Ensure your data format matches the selected type.
- **Plugin not loading**: Make sure you have run the build command (`pnpm build`).
- **Performance issues**: For very large tables (>2000 cells), consider splitting them into smaller chunks.

## 📝 License

This project is licensed under the MIT License.

## 🔗 Resources

- [Figma Plugin API Documentation](https://www.figma.com/plugin-docs/)
- [React Documentation](https://reactjs.org/)
- [Vite Documentation](https://vitejs.dev/)