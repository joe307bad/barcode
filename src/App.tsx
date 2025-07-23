import { useState, useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface SavedValues {
  rx: string
  ndc: string
  lotNumber: string
  serialNumber: string
  expirationDate: string
  timestamp: number
}

function App() {
  const [rx, setRx] = useState('')
  const [ndc, setNdc] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [savedValues, setSavedValues] = useState<SavedValues[]>([])
  const [dataMatrixUrl, setDataMatrixUrl] = useState('')

  const rxCanvasRef = useRef<HTMLCanvasElement>(null)
  const ndcCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('barcodeValues') || '[]')
    setSavedValues(saved)
  }, [])

  const saveValues = () => {
    const values: SavedValues = { rx, ndc, lotNumber, serialNumber, expirationDate, timestamp: Date.now() }
    const updated = [values, ...savedValues.slice(0, 9)]
    setSavedValues(updated)
    localStorage.setItem('barcodeValues', JSON.stringify(updated))
  }

  const loadValues = (values: SavedValues) => {
    setRx(values.rx)
    setNdc(values.ndc)
    setLotNumber(values.lotNumber)
    setSerialNumber(values.serialNumber)
    setExpirationDate(values.expirationDate)
  }

  const ndcToGtin = (ndc: string): string => {
    if (!ndc || ndc.trim() === '') {
      return '10300000000005'
    }

    const cleanNdc = ndc.replace(/[-]/g, '').replace(/\s/g, '')

    // Ensure we have exactly 10 digits for NDC
    if (cleanNdc.length !== 10 || !/^\d{10}$/.test(cleanNdc)) {
      return '10300000000005'
    }

    // Step 1: Create 13 digits: "103" + 10-digit NDC
    const digits13 = '103' + cleanNdc

    // Step 2: Calculate GTIN-14 check digit (treating 13 digits as GTIN-14 without check)
    let sum = 0
    // GTIN-14 algorithm: multiply by 3,1,3,1,3,1... from LEFT to RIGHT
    for (let i = 0; i < 13; i++) {
      const digit = parseInt(digits13[i])
      const multiplier = (i % 2 === 0) ? 3 : 1
      sum += digit * multiplier
    }

    const remainder = sum % 10
    const checkDigit = remainder === 0 ? 0 : 10 - remainder

    // Step 3: Create final 14-digit GTIN
    const gtin14 = digits13 + checkDigit.toString()

    return gtin14
  }

  const formatGS1Date = (dateStr: string): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''

    // GS1 date format: YYMMDD
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return year + month + day
  }

  const formatGS1Display = (gtin: string, expiryDate: string, batchLot: string, serialNumber: string): string => {
    let display = `(01)${gtin}`

    if (expiryDate) {
      display += `(17)${expiryDate}`
    }

    if (batchLot) {
      display += `(10)${batchLot}`
    }

    if (serialNumber) {
      display += `(21)${serialNumber}`
    }

    return display
  }

  const generateBarcodes = async () => {
    if (!rx || !ndc) {
      alert('Please fill in Rx and NDC fields')
      return
    }

    saveValues()

    // Generate Code-128 for Rx
    if (rxCanvasRef.current) {
      JsBarcode(rxCanvasRef.current, rx, { format: "CODE128" })
    }

    // Generate Code-128 for NDC
    if (ndcCanvasRef.current) {
      JsBarcode(ndcCanvasRef.current, ndc, { format: "CODE128" })
    }

    // Generate GS1 Data Matrix using URL API
    const gtin = ndcToGtin(ndc)
    const formattedDate = expirationDate ? formatGS1Date(expirationDate) : ''

    // Build GS1 display format for URL
    const gs1Display = formatGS1Display(gtin, formattedDate, lotNumber || '', serialNumber || '')

    // Create Data Matrix URL
    const dataMatrixApiUrl = `https://bwipjs-api.metafloor.com/?bcid=gs1datamatrix&text=${gs1Display}`

    setDataMatrixUrl(dataMatrixApiUrl)

    // Update the display text
    const displayElement = document.getElementById('gs1-display')
    if (displayElement) {
      displayElement.textContent = gs1Display
    }
  }

  return (
    <div>
      <h1>Barcode Generator</h1>

      <div>
        <div><input type="text" placeholder="Rx" value={rx} onChange={(e) => setRx(e.target.value)} /></div>
        <div><input type="text" placeholder="NDC (10 digits)" value={ndc} onChange={(e) => setNdc(e.target.value)} /></div>
        <div><input type="text" placeholder="Lot Number (optional)" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} /></div>
        <div><input type="text" placeholder="Serial Number (optional)" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} /></div>
        <div><input type="date" placeholder="Expiration Date (optional)" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} /></div>
        <button onClick={generateBarcodes}>Generate</button>
      </div>

      <div className="barcode-container">
        <div className="barcode-item">
          <h3>Rx Code-128:</h3>
          <canvas ref={rxCanvasRef}></canvas>
        </div>
        <div className="barcode-item">
          <h3>NDC Code-128:</h3>
          <canvas ref={ndcCanvasRef}></canvas>
        </div>
        <div className="barcode-item">
          <h3>GS1 Data Matrix:</h3>
          {dataMatrixUrl && <img src={dataMatrixUrl} alt="GS1 Data Matrix" style={{ width: '200px', height: '200px' }} />}
          <p id="gs1-display" style={{ fontSize: '12px', fontFamily: 'monospace', marginTop: '10px', wordBreak: 'break-all' }}>
            GS1 Data will appear here after generation
          </p>
        </div>
      </div>

      <div className="saved-values">
        {savedValues.map((values, index) => (
          <div key={index} className="saved-item" onClick={() => loadValues(values)}>
            {values.rx} | {values.ndc} | {values.lotNumber} | {values.serialNumber} | {values.expirationDate}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App