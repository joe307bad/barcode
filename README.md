# Barcode Generator

A simple MVP barcode generator for pharmaceutical data.

## Features
- Generate Code-128 barcodes for Rx and NDC
- Generate GS1 DataMatrix barcode encoding GTIN, lot number, serial number, and expiration date
- Save/load values from localStorage

## Usage
1. Install dependencies: `npm install`
2. Start local server: `npm run dev`
3. Open http://localhost:3000 in your browser

## Input Fields
- Rx: Prescription number
- NDC: National Drug Code
- Lot Number: Product lot number
- Serial Number: Product serial number
- Expiration Date: Product expiration date

Click "Generate" to create all three barcodes. Previous entries are saved and can be clicked to reload values.