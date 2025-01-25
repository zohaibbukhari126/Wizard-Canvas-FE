import { useEffect, useRef, useState } from "react"
import { ColorSwatch, Group } from "@mantine/core"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { SWATCHES } from "../../constants.ts"
import { ChevronLeft, ChevronRight, RefreshCw, Undo, Play } from "lucide-react"

interface GeneratedResult {
  expression: string
  answer: string
}

interface Response {
  expr: string
  result: string
  assign: boolean
}

export default function Home() {
    
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState("rgb(255, 255, 255)")
  const [reset, setReset] = useState(false)
  const [dictOfVars, setDictOfVars] = useState({})
  const [result, setResult] = useState<GeneratedResult>()
  const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 })
  const [latexExpression, setLatexExpression] = useState<Array<string>>([])
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [panelVisible, setPanelVisible] = useState(true)


  useEffect(() => {
    if (latexExpression.length > 0 && window.MathJax) {
      setTimeout(() => {
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub])
      }, 0)
    }
  }, [latexExpression])

  useEffect(() => {
    if (result) {
      renderLatexToCanvas(result.expression, result.answer)
    }
  }, [result])

  useEffect(() => {
    if (reset) {
      resetCanvas()
      setLatexExpression([])
      setResult(undefined)
      setDictOfVars({})
      setReset(false)
    }
  }, [reset])

  useEffect(() => {
    const canvas = canvasRef.current

    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight - canvas.offsetTop
        ctx.lineCap = "round"
        ctx.lineWidth = 3
      }
    }

    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML"
    script.async = true
    document.head.appendChild(script)

    script.onload = () => {
      window.MathJax.Hub.Config({
        tex2jax: {
          inlineMath: [
            ["$", "$"],
            ["$$", "$$"],
          ],
        },
      })
    }

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  const renderLatexToCanvas = (expression: string, answer: string) => {
    const latex = `\$$\\LARGE{${expression} = ${answer}}\$$`
    setLatexExpression([...latexExpression, latex])

    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }

  const resetCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
    setHistory([])
    setHistoryIndex(-1)
  }

  const saveCanvasState = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        setHistory((prevHistory) => [...prevHistory.slice(0, historyIndex + 1), imageData])
        setHistoryIndex((prevIndex) => prevIndex + 1)
      }
    }
  }

  const undo = () => {
    if (historyIndex > 0) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          const newHistoryIndex = historyIndex - 1
          setHistoryIndex(newHistoryIndex)
          ctx.putImageData(history[newHistoryIndex], 0, 0)
        }
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.background = "black"
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.beginPath()
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        setIsDrawing(true)
      }
    }
  }
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.strokeStyle = color
        ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
        ctx.stroke()
      }
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    saveCanvasState()
  }

  const runRoute = async () => {
    const canvas = canvasRef.current

    if (canvas) {
      const response = await axios({
        method: "post",
        url: `${import.meta.env.VITE_API_URL}/calculate`,
        data: {
          image: canvas.toDataURL("image/png"),
          dict_of_vars: dictOfVars,
        },
      })

      const resp = await response.data
      console.log("Response", resp)
      resp.data.forEach((data: Response) => {
        if (data.assign === true) {
          setDictOfVars({
            ...dictOfVars,
            [data.expr]: data.result,
          })
        }
      })
      const ctx = canvas.getContext("2d")
      const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height)
      let minX = canvas.width,
        minY = canvas.height,
        maxX = 0,
        maxY = 0

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4
          if (imageData.data[i + 3] > 0) {
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }
      }

      const centerX = (minX + maxX) / 2
      const centerY = (minY + maxY) / 2

      setLatexPosition({ x: centerX, y: centerY })
      resp.data.forEach((data: Response) => {
        setTimeout(() => {
          setResult({
            expression: data.expr,
            answer: data.result,
          })
        }, 1000)
      })
    }
  }

  return (
    <div className="relative h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {panelVisible && (
        <div className="absolute top-4 left-4 right-4 z-20 bg-gray-800/70 backdrop-blur-sm rounded-xl p-3 shadow-lg">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
              <Button 
                onClick={() => setReset(true)}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                variant="ghost"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
              <Button 
                onClick={undo}
                className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                variant="ghost"
                disabled={historyIndex <= 0}
              >
                <Undo className="w-5 h-5" />
              </Button>
            </div>

            <Group className="flex items-center space-x-2">
              {SWATCHES.map((swatch) => (
                <ColorSwatch 
                  key={swatch} 
                  color={swatch} 
                  onClick={() => setColor(swatch)}
                  className="cursor-pointer hover:scale-110 transition-transform"
                />
              ))}
            </Group>

            <Button
              onClick={runRoute}
              className="bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
              variant="ghost"
            >
              <Play className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      <div 
        className={`fixed top-1/2 transform -translate-y-1/2 z-30 transition-all duration-300 
        ${panelVisible ? 'left-[calc(5%+1rem)]' : 'left-2'}`}
      >
        <Button 
          onClick={() => setPanelVisible(!panelVisible)} 
          variant="outline" 
          size="icon" 
          className="bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 shadow-md"
        >
          {panelVisible ? <ChevronLeft /> : <ChevronRight />}
        </Button>
      </div>
  
      <canvas
        ref={canvasRef}
        id="canvas"
        className="absolute top-0 left-0 w-full h-full"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
      />
  
      {latexExpression &&
        latexExpression.map((latex, index) => (
          <div 
            key={index} 
            className="absolute p-3 text-white bg-black/30 backdrop-blur-sm rounded-lg shadow-lg"
            style={{ top: `${50 + index * 50}px`, left: '50%', transform: 'translateX(-50%)' }}
          >
            <div className="latex-content">{latex}</div>
          </div>
        ))}
    </div>
  )
}