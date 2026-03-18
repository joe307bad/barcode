import { useState, useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

const NUM_CUSTOM_BARCODES = 20
const NUM_GS1_BARCODES = 5

interface CustomBarcode {
  value: string
  label: string
}

interface GS1BarcodeEntry {
  ndc: string
  expirationDate: string
  lotNumber: string
  serialNumber: string
  label: string
}

interface SavedValues {
  rx: string
  rxLabel: string
  ndc: string
  ndcLabel: string
  lotNumber: string
  lotLabel: string
  serialNumber: string
  serialLabel: string
  expirationDate: string
  expLabel: string
  gs1Label: string
  customBarcodes: CustomBarcode[]
  gs1Barcodes: GS1BarcodeEntry[]
  timestamp: number
}

function App() {
  const [rx, setRx] = useState('')
  const [rxLabel, setRxLabel] = useState('')
  const [ndc, setNdc] = useState('')
  const [ndcLabel, setNdcLabel] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [lotLabel, setLotLabel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [serialLabel, setSerialLabel] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [expLabel, setExpLabel] = useState('')
  const [gs1Label, setGs1Label] = useState('')
  const [customBarcodes, setCustomBarcodes] = useState<CustomBarcode[]>(
    Array.from({ length: NUM_CUSTOM_BARCODES }, () => ({ value: '', label: '' }))
  )
  const [gs1Barcodes, setGs1Barcodes] = useState<GS1BarcodeEntry[]>(
    Array.from({ length: NUM_GS1_BARCODES }, () => ({ ndc: '', expirationDate: '', lotNumber: '', serialNumber: '', label: '' }))
  )
  const [savedValues, setSavedValues] = useState<SavedValues[]>([])
  const [dataMatrixUrl, setDataMatrixUrl] = useState('')
  const [gs1DisplayText, setGs1DisplayText] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null)

  const rxCanvasRef = useRef<HTMLCanvasElement>(null)
  const ndcCanvasRef = useRef<HTMLCanvasElement>(null)
  const customCanvasRefs = useRef<(HTMLCanvasElement | null)[]>(Array(NUM_CUSTOM_BARCODES).fill(null))

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('barcodeValues') || '[]')
    setSavedValues(saved)
  }, [])

  const saveValues = () => {
    const values: SavedValues = {
      rx, rxLabel, ndc, ndcLabel,
      lotNumber, lotLabel,
      serialNumber, serialLabel,
      expirationDate, expLabel,
      gs1Label,
      customBarcodes,
      gs1Barcodes,
      timestamp: Date.now(),
    }
    const updated = [values, ...savedValues.slice(0, 9)]
    setSavedValues(updated)
    localStorage.setItem('barcodeValues', JSON.stringify(updated))
  }

  const loadValues = (values: SavedValues) => {
    setRx(values.rx || '')
    setRxLabel(values.rxLabel || '')
    setNdc(values.ndc || '')
    setNdcLabel(values.ndcLabel || '')
    setLotNumber(values.lotNumber || '')
    setLotLabel(values.lotLabel || '')
    setSerialNumber(values.serialNumber || '')
    setSerialLabel(values.serialLabel || '')
    setExpirationDate(values.expirationDate || '')
    setExpLabel(values.expLabel || '')
    setGs1Label(values.gs1Label || '')
    const loaded = values.customBarcodes || []
    const padded: CustomBarcode[] = Array.from(
      { length: NUM_CUSTOM_BARCODES },
      (_, i) => loaded[i] || { value: '', label: '' }
    )
    setCustomBarcodes(padded)
    const loadedGs1 = values.gs1Barcodes || []
    const paddedGs1: GS1BarcodeEntry[] = Array.from(
      { length: NUM_GS1_BARCODES },
      (_, i) => loadedGs1[i] || { ndc: '', expirationDate: '', lotNumber: '', serialNumber: '', label: '' }
    )
    setGs1Barcodes(paddedGs1)
    setTimeout(() => generateBarcodesWithValues(values), 100)
  }

  const ndcToGtin = (ndc: string): string => {
    if (!ndc || ndc.trim() === '') return ''
    const cleanNdc = ndc.replace(/[-\s]/g, '')
    // Accept NDC-10 (10 digits) or NDC-11 (11 digits, zero-padded)
    if (!/^\d{10,11}$/.test(cleanNdc)) return ''
    const digits13 = cleanNdc.length === 11 ? '03' + cleanNdc : '103' + cleanNdc
    let sum = 0
    for (let i = 0; i < 13; i++) {
      sum += parseInt(digits13[i]) * (i % 2 === 0 ? 3 : 1)
    }
    const remainder = sum % 10
    const checkDigit = remainder === 0 ? 0 : 10 - remainder
    return digits13 + checkDigit.toString()
  }

  const formatGS1Date = (dateStr: string): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    const year = date.getFullYear().toString().slice(-2)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return year + month + day
  }

  const formatGS1Display = (gtin: string, expiryDate: string, batchLot: string, serial: string): string => {
    let display = `(01)${gtin}`
    if (expiryDate) display += `(17)${expiryDate}`
    if (batchLot) display += `(10)${batchLot}`
    if (serial) display += `(21)${serial}`
    return display
  }

  const handleBarcodeClick = (barcodeType: string) => {
    setSelectedBarcode(selectedBarcode === barcodeType ? null : barcodeType)
    updateGS1Display()
  }

  useEffect(() => {
    if (hasGenerated) {
      updateBarcodeVisibility()
      updateGS1Display()
    }
  }, [selectedBarcode, hasGenerated, rx, ndc, customBarcodes])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || selectedBarcode === null || !hasGenerated) return
      e.preventDefault()
      const keys: string[] = []
      if (rx) keys.push('rx')
      if (ndc) keys.push('ndc')
      if (ndc && ndcToGtin(ndc)) keys.push('gs1')
      gs1Barcodes.forEach((bc, i) => { if (ndcToGtin(bc.ndc)) keys.push(`gs1extra${i}`) })
      customBarcodes.forEach((bc, i) => { if (bc.value) keys.push(`custom${i}`) })
      if (keys.length === 0) return
      const currentIndex = keys.indexOf(selectedBarcode)
      const nextIndex = (currentIndex + 1) % keys.length
      setSelectedBarcode(keys[nextIndex])
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [hasGenerated, selectedBarcode, rx, ndc, customBarcodes, gs1Barcodes])

  const updateGS1Display = () => {
    if (selectedBarcode === null || selectedBarcode === 'gs1') {
      const gtin = ndcToGtin(ndc)
      if (gtin) {
        setGs1DisplayText(formatGS1Display(gtin, expirationDate ? formatGS1Date(expirationDate) : '', lotNumber, serialNumber))
      } else {
        setGs1DisplayText('')
      }
    } else {
      setGs1DisplayText('')
    }
  }

  const clearCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const updateBarcodeVisibility = () => {
    if (rxCanvasRef.current) clearCanvas(rxCanvasRef.current)
    if (ndcCanvasRef.current) clearCanvas(ndcCanvasRef.current)
    customCanvasRefs.current.forEach(ref => { if (ref) clearCanvas(ref) })

    if (rx && rxCanvasRef.current && (selectedBarcode === null || selectedBarcode === 'rx')) {
      JsBarcode(rxCanvasRef.current, rx, { format: 'CODE128' })
    }
    if (ndc && ndcCanvasRef.current && (selectedBarcode === null || selectedBarcode === 'ndc')) {
      JsBarcode(ndcCanvasRef.current, ndc, { format: 'CODE128' })
    }
    customBarcodes.forEach((bc, i) => {
      const ref = customCanvasRefs.current[i]
      const key = `custom${i}`
      if (bc.value && ref && (selectedBarcode === null || selectedBarcode === key)) {
        JsBarcode(ref, bc.value, { format: 'CODE128' })
      }
    })
  }

  const updateBarcodeVisibilityWithValues = (values: SavedValues) => {
    if (rxCanvasRef.current) clearCanvas(rxCanvasRef.current)
    if (ndcCanvasRef.current) clearCanvas(ndcCanvasRef.current)
    customCanvasRefs.current.forEach(ref => { if (ref) clearCanvas(ref) })

    if (values.rx && rxCanvasRef.current && (selectedBarcode === null || selectedBarcode === 'rx')) {
      JsBarcode(rxCanvasRef.current, values.rx, { format: 'CODE128' })
    }
    if (values.ndc && ndcCanvasRef.current && (selectedBarcode === null || selectedBarcode === 'ndc')) {
      JsBarcode(ndcCanvasRef.current, values.ndc, { format: 'CODE128' })
    }
    const customs = values.customBarcodes || []
    customs.forEach((bc, i) => {
      const ref = customCanvasRefs.current[i]
      const key = `custom${i}`
      if (bc.value && ref && (selectedBarcode === null || selectedBarcode === key)) {
        JsBarcode(ref, bc.value, { format: 'CODE128' })
      }
    })

    if (selectedBarcode === null || selectedBarcode === 'gs1') {
      const gtin = ndcToGtin(values.ndc || '')
      if (gtin) {
        setGs1DisplayText(formatGS1Display(gtin, values.expirationDate ? formatGS1Date(values.expirationDate) : '', values.lotNumber, values.serialNumber))
      } else {
        setGs1DisplayText('')
      }
    }
  }

  const generateBarcodes = async () => {
    saveValues()
    setHasGenerated(true)

    const gtin = ndcToGtin(ndc)
    if (gtin) {
      const gs1Display = formatGS1Display(gtin, expirationDate ? formatGS1Date(expirationDate) : '', lotNumber, serialNumber)
      setDataMatrixUrl(`https://bwipjs-api.metafloor.com/?bcid=gs1datamatrix&text=${encodeURIComponent(gs1Display)}`)
      setGs1DisplayText(gs1Display)
    } else {
      setDataMatrixUrl('')
      setGs1DisplayText('')
    }

    updateBarcodeVisibility()
  }

  const generateBarcodesWithValues = async (values: SavedValues) => {
    setHasGenerated(true)

    const gtin = ndcToGtin(values.ndc || '')
    if (gtin) {
      const gs1Display = formatGS1Display(gtin, values.expirationDate ? formatGS1Date(values.expirationDate) : '', values.lotNumber, values.serialNumber)
      setDataMatrixUrl(`https://bwipjs-api.metafloor.com/?bcid=gs1datamatrix&text=${encodeURIComponent(gs1Display)}`)
      setGs1DisplayText(gs1Display)
    } else {
      setDataMatrixUrl('')
      setGs1DisplayText('')
    }

    updateBarcodeVisibilityWithValues(values)
  }

  const updateCustomBarcode = (index: number, field: 'value' | 'label', val: string) => {
    setCustomBarcodes(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: val }
      return updated
    })
  }

  const updateGs1Barcode = (index: number, field: keyof GS1BarcodeEntry, val: string) => {
    setGs1Barcodes(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: val }
      return updated
    })
  }

  const [inputsCollapsed, setInputsCollapsed] = useState(false)

  const inputRowStyle: React.CSSProperties = { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }
  const labelInputStyle: React.CSSProperties = { width: '150px' }

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div style={{ flex: '1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0 }}>Barcode Generator</h1>
          <button onClick={() => setInputsCollapsed(c => !c)} style={{ padding: '4px 10px', fontSize: '13px' }}>
            {inputsCollapsed ? 'Show Inputs' : 'Hide Inputs'}
          </button>
        </div>

        <div style={{ display: inputsCollapsed ? 'none' : 'block', marginTop: '16px' }}>
          <div style={inputRowStyle}>
            <input type="text" placeholder="Rx" value={rx} onChange={(e) => setRx(e.target.value)} />
            <input type="text" placeholder="Label (optional)" value={rxLabel} onChange={(e) => setRxLabel(e.target.value)} style={labelInputStyle} />
          </div>
          <div style={inputRowStyle}>
            <input type="text" placeholder="NDC (10 digits)" value={ndc} onChange={(e) => setNdc(e.target.value)} />
            <input type="text" placeholder="Label (optional)" value={ndcLabel} onChange={(e) => setNdcLabel(e.target.value)} style={labelInputStyle} />
          </div>
          <div style={inputRowStyle}>
            <input type="text" placeholder="Lot Number" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
            <input type="text" placeholder="Label (optional)" value={lotLabel} onChange={(e) => setLotLabel(e.target.value)} style={labelInputStyle} />
          </div>
          <div style={inputRowStyle}>
            <input type="text" placeholder="Serial Number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
            <input type="text" placeholder="Label (optional)" value={serialLabel} onChange={(e) => setSerialLabel(e.target.value)} style={labelInputStyle} />
          </div>
          <div style={inputRowStyle}>
            <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
            <input type="text" placeholder="Label (optional)" value={expLabel} onChange={(e) => setExpLabel(e.target.value)} style={labelInputStyle} />
          </div>
          <div style={inputRowStyle}>
            <span style={{ width: '210px', display: 'inline-block', color: '#555', fontSize: '14px' }}>GS1 Data Matrix</span>
            <input type="text" placeholder="Label (optional)" value={gs1Label} onChange={(e) => setGs1Label(e.target.value)} style={labelInputStyle} />
          </div>

          <hr style={{ margin: '12px 0 4px' }} />
          <div style={{ color: '#555', fontSize: '13px', marginBottom: '4px' }}>Extra GS1 Data Matrix barcodes</div>
          {gs1Barcodes.map((bc, i) => (
            <div key={i} style={{ ...inputRowStyle, flexWrap: 'wrap' }}>
              <input type="text" placeholder={`NDC ${i + 2}`} value={bc.ndc} onChange={(e) => updateGs1Barcode(i, 'ndc', e.target.value)} />
              <input type="date" value={bc.expirationDate} onChange={(e) => updateGs1Barcode(i, 'expirationDate', e.target.value)} />
              <input type="text" placeholder="Lot" value={bc.lotNumber} onChange={(e) => updateGs1Barcode(i, 'lotNumber', e.target.value)} style={{ width: '80px' }} />
              <input type="text" placeholder="Serial" value={bc.serialNumber} onChange={(e) => updateGs1Barcode(i, 'serialNumber', e.target.value)} style={{ width: '80px' }} />
              <input type="text" placeholder="Label (optional)" value={bc.label} onChange={(e) => updateGs1Barcode(i, 'label', e.target.value)} style={labelInputStyle} />
            </div>
          ))}

          <hr style={{ margin: '12px 0' }} />

          {customBarcodes.map((bc, i) => (
            <div key={i} style={inputRowStyle}>
              <input type="text" placeholder={`Barcode ${i + 1}`} value={bc.value} onChange={(e) => updateCustomBarcode(i, 'value', e.target.value)} />
              <input type="text" placeholder="Label (optional)" value={bc.label} onChange={(e) => updateCustomBarcode(i, 'label', e.target.value)} style={labelInputStyle} />
            </div>
          ))}

          <button onClick={generateBarcodes}>Generate</button>
        </div>

        {hasGenerated && (
          <div className="barcode-container" style={{ display: 'flex', flexDirection: 'row', gap: '20px', marginTop: '20px', flexWrap: 'wrap' }}>
            {rx && (
              <div className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === 'rx' ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick('rx')}>
                <h3>{rxLabel || 'Rx Code-128'}:</h3>
                {(selectedBarcode === null || selectedBarcode === 'rx') && <canvas ref={rxCanvasRef}></canvas>}
              </div>
            )}
            {ndc && (
              <div className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === 'ndc' ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick('ndc')}>
                <h3>{ndcLabel || 'NDC Code-128'}:</h3>
                {(selectedBarcode === null || selectedBarcode === 'ndc') && <canvas ref={ndcCanvasRef}></canvas>}
              </div>
            )}
            {ndc && ndcToGtin(ndc) && (
              <div className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === 'gs1' ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick('gs1')}>
                <h3>{gs1Label || 'GS1 Data Matrix'}:</h3>
                {(selectedBarcode === null || selectedBarcode === 'gs1') && (
                  <>
                    {dataMatrixUrl && <img src={dataMatrixUrl} alt="GS1 Data Matrix" style={{ width: '200px', height: '200px' }} />}
                    <p style={{ fontSize: '12px', fontFamily: 'monospace', marginTop: '10px', wordBreak: 'break-all' }}>{gs1DisplayText}</p>
                  </>
                )}
              </div>
            )}
            {gs1Barcodes.map((bc, i) => {
              const gtin = ndcToGtin(bc.ndc)
              if (!gtin) return null
              const key = `gs1extra${i}`
              const gs1Display = formatGS1Display(gtin, bc.expirationDate ? formatGS1Date(bc.expirationDate) : '', bc.lotNumber, bc.serialNumber)
              const url = `https://bwipjs-api.metafloor.com/?bcid=gs1datamatrix&text=${encodeURIComponent(gs1Display)}`
              return (
                <div key={i} className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === key ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick(key)}>
                  <h3>{bc.label || `GS1 Data Matrix ${i + 2}`}:</h3>
                  {(selectedBarcode === null || selectedBarcode === key) && (
                    <>
                      <img src={url} alt="GS1 Data Matrix" style={{ width: '200px', height: '200px' }} />
                      <p style={{ fontSize: '12px', fontFamily: 'monospace', marginTop: '10px', wordBreak: 'break-all' }}>{gs1Display}</p>
                    </>
                  )}
                </div>
              )
            })}
            {customBarcodes.map((bc, i) => {
              if (!bc.value) return null
              const key = `custom${i}`
              return (
                <div key={i} className="barcode-item" style={{ cursor: 'pointer', border: selectedBarcode === key ? '2px solid blue' : '1px solid #ddd', padding: '10px' }} onClick={() => handleBarcodeClick(key)}>
                  <h3>{bc.label || `Barcode ${i + 1}`}:</h3>
                  {(selectedBarcode === null || selectedBarcode === key) && (
                    <canvas ref={el => { customCanvasRefs.current[i] = el }}></canvas>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="saved-values" style={{ flex: '0 0 300px', paddingLeft: '20px', borderLeft: '1px solid #ccc' }}>
        {savedValues.map((values, index) => (
          <div key={index} className="saved-item" onClick={() => loadValues(values)} style={{ cursor: 'pointer', padding: '8px', border: '1px solid #ddd', margin: '5px 0', fontSize: '12px' }}>
            {[values.rx, values.ndc, values.lotNumber].filter(Boolean).join(' | ')}
            {' '}{new Date(values.timestamp).toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
