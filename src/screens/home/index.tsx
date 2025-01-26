import { useEffect, useRef, useState } from "react"
import { ColorSwatch, Group } from "@mantine/core"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { SWATCHES } from "../../constants"
import { ChevronDown, ChevronUp, RefreshCw, Undo, Play, Brush, Eraser } from "lucide-react"

import { themeColors } from "@/styles/themes"
import { motion } from "framer-motion";

interface GeneratedResult {
  expression: string
  answer: string
}

interface Response {
  expr: string
  result: string
  assign: boolean
}

interface LatexExpression {
  text: string
  pos: { x: number; y: number }
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [color, setColor] = useState("rgb(255, 255, 255)")
  const [reset, setReset] = useState(false)
  const [dictOfVars, setDictOfVars] = useState({})
  const [result, setResult] = useState<GeneratedResult>()
  const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 })
  const [latexExpression, setLatexExpression] = useState<LatexExpression[]>([])
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [panelVisible, setPanelVisible] = useState(true)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [isEraser, setIsEraser] = useState(false)
  const [eraserSize, setEraserSize] = useState(10)
  const [brushSize, setBrushSize] = useState(3)

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
    setLatexExpression((prev) => [
      ...prev,
      {
        text: latex,
        pos: {
          x: (window.innerWidth - 200) / 2, // Center horizontally (assuming 200 is the width of the text box)
          y: 50 + prev.length * 50, // Adjust the vertical position based on previous items
        },
      },
    ])

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
      canvas.style.background = theme === "dark" ? "#1E293B" : "white"
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
        if (isEraser) {
          ctx.globalCompositeOperation = "destination-out"
          ctx.beginPath()
          ctx.arc(e.nativeEvent.offsetX, e.nativeEvent.offsetY, eraserSize / 2, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.globalCompositeOperation = "source-over"
          ctx.strokeStyle = color
          ctx.lineWidth = brushSize
          ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY)
          ctx.stroke()
        }
      }
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    saveCanvasState()
  }

  const handleLatexMouseDown = (index: number, e: React.MouseEvent) => {
    setDraggingIndex(index)
  }

  const handleLatexMouseMove = (e: React.MouseEvent) => {
    if (draggingIndex !== null) {
      setLatexExpression((prev) => {
        const newLatexExpression = [...prev]
        newLatexExpression[draggingIndex].pos = {
          x: e.clientX,
          y: e.clientY,
        }
        return newLatexExpression
      })
    }
  }

  const handleLatexMouseUp = () => {
    setDraggingIndex(null)
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
          setDictOfVars((prevDictOfVars) => ({
            ...prevDictOfVars,
            [data.expr]: data.result,
          }))
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.style.background = themeColors[theme].canvasBackground
    }
  }, [theme])

  const toggleEraser = () => {
    setIsEraser(!isEraser)
    if (isEraser) {
      setColor(SWATCHES[0]) // Set to the first color in SWATCHES when switching back to brush
    }
  }

  return (
    <div
      className={`relative h-screen overflow-hidden ${theme === "dark" ? "bg-black" : "bg-white"}`}
      onMouseMove={handleLatexMouseMove}
      onMouseUp={handleLatexMouseUp}
    >
      
      {panelVisible && (
        <div
          className="absolute bottom-4 left-4 right-4 z-20 backdrop-blur-sm rounded-xl p-3 shadow-lg"
          style={{
            backgroundColor: themeColors[theme].menuBar.background,
            color: themeColors[theme].menuBar.text,
          }}
        >
          <div className="flex items-center justify-between space-x-2">
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setReset(true)}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-red-500/10 text-red-600 hover:bg-red-500/20"
                  } transition-colors`}
                variant="ghost"
              >
                <RefreshCw className="w-5 h-5" />
              </Button>
              <Button
                onClick={undo}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                      : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                  } transition-colors`}
                variant="ghost"
                disabled={historyIndex <= 0}
              >
                <Undo className="w-5 h-5" />
              </Button>
            </div>

            <Group className="flex items-center space-x-1">
              {SWATCHES.map((swatch) => (
                <ColorSwatch
                  key={swatch}
                  color={swatch}
                  onClick={() => {
                    setColor(swatch)
                    setIsEraser(false)
                  }}
                  className="cursor-pointer hover:scale-110 transition-transform w-6 h-6"
                />
              ))}
            </Group>

            <div className="flex items-center space-x-2">
              {!isEraser ? (
                <>
                  <label htmlFor="brush-size" className="text-sm">
                    Brush:
                  </label>
                  <input
                    id="brush-size"
                    type="range"
                    min="1"
                    max="50"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number.parseInt(e.target.value))}
                    className="w-24"
                  />
                </>
              ) : (
                <>
                  <label htmlFor="eraser-size" className="text-sm">
                    Eraser:
                  </label>
                  <input
                    id="eraser-size"
                    type="range"
                    min="5"
                    max="50"
                    value={eraserSize}
                    onChange={(e) => setEraserSize(Number.parseInt(e.target.value))}
                    className="w-24"
                  />
                </>
              )}
            </div>
            <div className="flex items-center space-x-2">
              
            <Button
                onClick={toggleEraser}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                      : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                  } transition-colors`}
                variant="ghost"
              >
                {isEraser ? <Brush className="w-5 h-5" /> : <Eraser className="w-5 h-5" />}
              </Button>
              <Button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                      : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                  } transition-colors`}
                variant="ghost"
              >
                {theme === "dark" ? "Light" : "Dark"}
              </Button>
              
              <Button
                onClick={runRoute}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                      : "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                  } transition-colors`}
                variant="ghost"
              >
                <Play className="w-5 h-5" />
              </Button>
            </div>

            
          </div>
        </div>
      )}

      <div
        className={`fixed left-1/2 transform -translate-x-1/2 z-40 transition-all duration-300 
        ${panelVisible ? "bottom-16" : "bottom-2"}`}
      >
        <Button
      onClick={() => setPanelVisible(!panelVisible)}
      variant="outline"
      size="icon"
      className="bg-white/10 backdrop-blur-sm text-white dark:text-black hover:bg-white/20 shadow-lg w-8 h-8 p-1"
    >
      {panelVisible ? (
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            repeatType: "loop",
          }}
        >
          <ChevronDown className="w-4 h-4 text-black dark:text-purple-500" />
        </motion.div>
      ) : (
        <motion.div
          animate={{ y: [0, 4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            repeatType: "loop",
          }}
        >
          <ChevronUp className="w-4 h-4 text-black dark:text-purple-500" />
        </motion.div>
      )}
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

      {latexExpression.map((latex, index) => (
        <div
          key={index}
          className="absolute p-3 backdrop-blur-sm rounded-lg cursor-move"
          style={{
            left: `${latex.pos.x}px`,
            top: `${latex.pos.y}px`,
            color: themeColors[theme].latexBox.text,
            backgroundColor: themeColors[theme].latexBox.background,
          }}
          onMouseDown={(e) => handleLatexMouseDown(index, e)}
        >
          <div className="latex-content">{latex.text}</div>
        </div>
      ))}
    </div>
  )
}

