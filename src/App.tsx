import { useState, useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface SavedValues {
  rx: string
  ndc: string
  lotNumber: string
  serialNumber: string
  expirationDate: string
  barcode1: string
  barcode2: string
  timestamp: number
}

function App() {
  const [rx, setRx] = useState('')
  const [ndc, setNdc] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [barcode1, setBarcode1] = useState('')
  const [barcode2, setBarcode2] = useState('')
  const [savedValues, setSavedValues] = useState<SavedValues[]>([])
  const [dataMatrixUrl, setDataMatrixUrl] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null)

  const rxCanvasRef = useRef<HTMLCanvasElement>(null)
  const ndcCanvasRef = useRef<HTMLCanvasElement>(null)
  const barcode1CanvasRef = useRef<HTMLCanvasElement>(null)
  const barcode2CanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('barcodeValues') || '[]')
    setSavedValues(saved)
  }, [])

  const saveValues = () => {
    const values: SavedValues = { rx, ndc, lotNumber, serialNumber, expirationDate, barcode1, barcode2, timestamp: Date.now() }
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
    setBarcode1(values.barcode1 || '')
    setBarcode2(values.barcode2 || '')
    
    // Auto-generate after loading values - check values directly instead of state
    if (values.rx && values.ndc) {
      setTimeout(() => {
        generateBarcodesWithValues(values)
      }, 100)
    }
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

  const handleBarcodeClick = (barcodeType: string) => {
    if (selectedBarcode === barcodeType) {
      setSelectedBarcode(null) // Show all barcodes
    } else {
      setSelectedBarcode(barcodeType) // Show only selected barcode
    }
    
    // Update GS1 display text visibility
    updateGS1Display()
  }

  // Update barcodes when selection changes
  useEffect(() => {
    if (hasGenerated) {
      updateBarcodeVisibility()
      updateGS1Display()
    }
  }, [selectedBarcode, hasGenerated, rx, ndc, barcode1, barcode2])

  const updateGS1Display = () => {
    const displayElement = document.getElementById('gs1-display')
    if (displayElement) {
      if (selectedBarcode === null || selectedBarcode === 'gs1') {
        // Show GS1 data if GS1 is visible
        const gtin = ndcToGtin(ndc)
        const formattedDate = expirationDate ? formatGS1Date(expirationDate) : ''
        const gs1Display = formatGS1Display(gtin, formattedDate, lotNumber || '', serialNumber || '')
        displayElement.textContent = gs1Display
      } else {
        // Clear text if GS1 is hidden
        displayElement.textContent = ''
      }
    }
  }

  const updateBarcodeVisibility = () => {
    // Clear all canvases first
    if (rxCanvasRef.current) clearCanvas(rxCanvasRef.current)
    if (ndcCanvasRef.current) clearCanvas(ndcCanvasRef.current)
    if (barcode1CanvasRef.current) clearCanvas(barcode1CanvasRef.current)
    if (barcode2CanvasRef.current) clearCanvas(barcode2CanvasRef.current)

    // Generate only visible barcodes
    if (rxCanvasRef.current && (selectedBarcode === null || selectedBarcode === 'rx')) {
      JsBarcode(rxCanvasRef.current, rx, { format: "CODE128" })
    }

    if (ndcCanvasRef.current && (selectedBarcode === null || selectedBarcode === 'ndc')) {
      JsBarcode(ndcCanvasRef.current, ndc, { format: "CODE128" })
    }

    if (barcode1 && barcode1CanvasRef.current && (selectedBarcode === null || selectedBarcode === 'barcode1')) {
      JsBarcode(barcode1CanvasRef.current, barcode1, { format: "CODE128" })
    }

    if (barcode2 && barcode2CanvasRef.current && (selectedBarcode === null || selectedBarcode === 'barcode2')) {
      JsBarcode(barcode2CanvasRef.current, barcode2, { format: "CODE128" })
    }
  }

  const updateBarcodeVisibilityWithValues = (values: SavedValues) => {
    // Clear all canvases first
    if (rxCanvasRef.current) clearCanvas(rxCanvasRef.current)
    if (ndcCanvasRef.current) clearCanvas(ndcCanvasRef.current)
    if (barcode1CanvasRef.current) clearCanvas(barcode1CanvasRef.current)
    if (barcode2CanvasRef.current) clearCanvas(barcode2CanvasRef.current)

    // Generate only visible barcodes using provided values
    if (rxCanvasRef.current && (selectedBarcode === null || selectedBarcode === 'rx')) {
      JsBarcode(rxCanvasRef.current, values.rx, { format: "CODE128" })
    }

    if (ndcCanvasRef.current && (selectedBarcode === null || selectedBarcode === 'ndc')) {
      JsBarcode(ndcCanvasRef.current, values.ndc, { format: "CODE128" })
    }

    if (values.barcode1 && barcode1CanvasRef.current && (selectedBarcode === null || selectedBarcode === 'barcode1')) {
      JsBarcode(barcode1CanvasRef.current, values.barcode1, { format: "CODE128" })
    }

    if (values.barcode2 && barcode2CanvasRef.current && (selectedBarcode === null || selectedBarcode === 'barcode2')) {
      JsBarcode(barcode2CanvasRef.current, values.barcode2, { format: "CODE128" })
    }

    // Update GS1 display text with provided values
    updateGS1DisplayWithValues(values)
  }

  const updateGS1DisplayWithValues = (values: SavedValues) => {
    const displayElement = document.getElementById('gs1-display')
    if (displayElement) {
      if (selectedBarcode === null || selectedBarcode === 'gs1') {
        // Show GS1 data if GS1 is visible
        const gtin = ndcToGtin(values.ndc)
        const formattedDate = values.expirationDate ? formatGS1Date(values.expirationDate) : ''
        const gs1Display = formatGS1Display(gtin, formattedDate, values.lotNumber || '', values.serialNumber || '')
        displayElement.textContent = gs1Display
      } else {
        // Clear text if GS1 is hidden
        displayElement.textContent = ''
      }
    }
  }

  const clearCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const generateBarcodes = async () => {
    if (!rx || !ndc) {
      alert('Please fill in Rx and NDC fields')
      return
    }

    saveValues()
    setHasGenerated(true)

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

    // Generate barcodes based on current selection
    updateBarcodeVisibility()
  }

  const generateBarcodesWithValues = async (values: SavedValues) => {
    setHasGenerated(true)

    // Generate GS1 Data Matrix using URL API
    const gtin = ndcToGtin(values.ndc)
    const formattedDate = values.expirationDate ? formatGS1Date(values.expirationDate) : ''

    // Build GS1 display format for URL
    const gs1Display = formatGS1Display(gtin, formattedDate, values.lotNumber || '', values.serialNumber || '')

    // Create Data Matrix URL
    const dataMatrixApiUrl = `https://bwipjs-api.metafloor.com/?bcid=gs1datamatrix&text=${gs1Display}`
    setDataMatrixUrl(dataMatrixApiUrl)

    // Update the display text
    const displayElement = document.getElementById('gs1-display')
    if (displayElement) {
      displayElement.textContent = gs1Display
    }

    // Generate barcodes with provided values
    updateBarcodeVisibilityWithValues(values)
  }

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div style={{ flex: '1' }}>
        <h1>Barcode Generator</h1>

        <div>
          <div><input type="text" placeholder="Rx" value={rx} onChange={(e) => setRx(e.target.value)} /></div>
          <div><input type="text" placeholder="NDC (10 digits)" value={ndc} onChange={(e) => setNdc(e.target.value)} /></div>
          <div><input type="text" placeholder="Lot Number (optional)" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} /></div>
          <div><input type="text" placeholder="Serial Number (optional)" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} /></div>
          <div><input type="date" placeholder="Expiration Date (optional)" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} /></div>
          
          <hr style={{ margin: '20px 0' }} />
          
          <div><input type="text" placeholder="Barcode 1" value={barcode1} onChange={(e) => setBarcode1(e.target.value)} /></div>
          <div><input type="text" placeholder="Barcode 2" value={barcode2} onChange={(e) => setBarcode2(e.target.value)} /></div>
          
          <button onClick={generateBarcodes}>Generate</button>
        </div>

        {hasGenerated && (
          <div className="barcode-container" style={{ display: 'flex', flexDirection: 'row', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
            <div className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === 'rx' ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick('rx')}>
              <h3>Rx Code-128:</h3>
              {(selectedBarcode === null || selectedBarcode === 'rx') && <canvas ref={rxCanvasRef}></canvas>}
            </div>
            <div className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === 'ndc' ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick('ndc')}>
              <h3>NDC Code-128:</h3>
              {(selectedBarcode === null || selectedBarcode === 'ndc') && <canvas ref={ndcCanvasRef}></canvas>}
            </div>
            <div className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === 'gs1' ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick('gs1')}>
              <h3>GS1 Data Matrix:</h3>
              {(selectedBarcode === null || selectedBarcode === 'gs1') && (
                <>
                  {dataMatrixUrl && <img src={dataMatrixUrl} alt="GS1 Data Matrix" style={{ width: '200px', height: '200px' }} />}
                  <p id="gs1-display" style={{ fontSize: '12px', fontFamily: 'monospace', marginTop: '10px', wordBreak: 'break-all' }}>
                  </p>
                </>
              )}
            </div>
            {barcode1 && (
              <div className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === 'barcode1' ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick('barcode1')}>
                <h3>Barcode 1:</h3>
                {(selectedBarcode === null || selectedBarcode === 'barcode1') && <canvas ref={barcode1CanvasRef}></canvas>}
              </div>
            )}
            {barcode2 && (
              <div className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === 'barcode2' ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick('barcode2')}>
                <h3>Barcode 2:</h3>
                {(selectedBarcode === null || selectedBarcode === 'barcode2') && <canvas ref={barcode2CanvasRef}></canvas>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="saved-values" style={{ flex: '0 0 300px', paddingLeft: '20px', borderLeft: '1px solid #ccc' }}>
        {savedValues.map((values, index) => (
          <div key={index} className="saved-item" onClick={() => loadValues(values)} style={{ cursor: 'pointer', padding: '8px', border: '1px solid #ddd', margin: '5px 0', fontSize: '12px' }}>
            {values.rx} | {values.ndc} | {values.lotNumber} | {values.serialNumber} | {values.expirationDate} | {values.barcode1 || ''} | {values.barcode2 || ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App