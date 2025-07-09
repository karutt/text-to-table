# Text to Table - Figma Plugin

A high-performance Figma plugin that converts text data (CSV, TSV, Markdown tables) into beautiful, styled tables directly in your Figma designs.

<!-- ![Text to Table Demo GIF](placeholder.gif) -->
<!-- TODO: Add a GIF demonstrating the plugin in action -->

## Table of Contents

1. [Text to Table - Figma Plugin](#text-to-table---figma-plugin)
    1. [Table of Contents](#table-of-contents)
    2. [✨ Key Features](#-key-features)
    3. [🚀 Getting Started](#-getting-started)
        1. [Prerequisites](#prerequisites)
        2. [Installation](#installation)
    4. [Usage](#usage)
    5. [Supported Formats](#supported-formats)
    6. [🛠️ For Developers](#️-for-developers)
        1. [Development Mode](#development-mode)
        2. [Code Quality](#code-quality)
        3. [Contributing](#contributing)
    7. [📝 License](#-license)
    8. [🔗 Resources](#-resources)

## ✨ Key Features

- **Smart Markdown Processing**: Automatically detects and extracts table content from mixed markdown text
- **Text Formatting Support**: Preserves **bold** and _italic_ formatting from markdown text
- **Multiple Format Support**: Generate tables from CSV, TSV, and Markdown data
- **File Upload Support**: Drag and drop files (.csv, .tsv, .md, .txt) or paste data manually
- **Table Editing**: Edit created tables using Figma's selection tool

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
>
> ```csv
> Name,Age,City
> John,25,Tokyo
> Jane,30,Osaka
> ```

> **TSV (Tab-Separated Values)**
>
> ```tsv
> Name	Age	City
> John	25	Tokyo
> Jane	30	Osaka
> ```

> **Markdown Tables**
>
> ```markdown
> | Name     | Age | City  |
> | -------- | --- | ----- |
> | **John** | 25  | Tokyo |
> | _Jane_   | 30  | Osaka |
> ```
>
> **Enhanced Markdown Features:**
>
> - Automatically extracts table data from mixed markdown content
> - Supports **bold** text formatting (`**text**` or `__text__`)
> - Supports _italic_ text formatting (`*text*` or `_text_`)
> - Mixed content example:
>
>     ```markdown
>     # Some Document
>
>     Here's some text before the table.
>
>     | Product | **Price** | _Category_    |
>     | ------- | --------- | ------------- |
>     | Laptop  | **$1200** | _Electronics_ |
>     | Book    | $20       | Education     |
>
>     Text after the table is ignored.
>     ```

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

### Contributing

Contributions are welcome!

1.  Fork the repository.
2.  Create a feature branch: `git checkout -b feature/new-feature`
3.  Make your changes.
4.  Ensure all checks pass: `pnpm lint && pnpm build`
5.  Submit a pull request.

## 📝 License

This project is licensed under the MIT License.

## 🔗 Resources

- [Figma Plugin API Documentation](https://www.figma.com/plugin-docs/)
- [React Documentation](https://reactjs.org/)
- [Vite Documentation](https://vitejs.dev/)
