import { useEffect, useRef, useState } from "react"
import { ColorSwatch, Group,Tooltip } from "@mantine/core"
import { Button } from "@/components/ui/button"
import axios from "axios"
import { SWATCHES } from "../../constants"
import { ChevronDown, ChevronUp, RefreshCw, Undo, Play, Brush, Eraser, Square, Circle, Minus } from "lucide-react"

import { themeColors } from "@/styles/themes"
import { motion } from "framer-motion"

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

interface DrawingElement {
  type: "brush" | "eraser" | "line" | "rectangle" | "circle"
  points?: { x: number; y: number }[]
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  color: string
  size: number
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
  const [history, setHistory] = useState<DrawingElement[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [panelVisible, setPanelVisible] = useState(true)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [eraserSize, setEraserSize] = useState(10)
  const [brushSize, setBrushSize] = useState(3)
  const [tool, setTool] = useState<"brush" | "eraser" | "line" | "rectangle" | "circle">("brush")
  const [drawingElements, setDrawingElements] = useState<DrawingElement[]>([])
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null)

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
        ctx.lineJoin = "round"
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

  useEffect(() => {
    redrawCanvas()
  }, [drawingElements]) // Removed theme from dependencies

  const renderLatexToCanvas = (expression: string, answer: string) => {
    const latex = `\$$\\LARGE{${expression} = ${answer}}\$$`
    setLatexExpression((prev) => [
      ...prev,
      {
        text: latex,
        pos: {
          x: (window.innerWidth - 200) / 2,
          y: 50 + prev.length * 50,
        },
      },
    ])
  }

  const resetCanvas = () => {
    setDrawingElements([])
    setHistory([])
    setHistoryIndex(-1)
  }

  const saveCanvasState = () => {
    setHistory((prevHistory) => [...prevHistory.slice(0, historyIndex + 1), drawingElements])
    setHistoryIndex((prevIndex) => prevIndex + 1)
  }

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex((prevIndex) => prevIndex - 1)
      setDrawingElements(history[historyIndex - 1])
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setIsDrawing(true)

      const newElement: DrawingElement = {
        type: tool,
        color: tool === "eraser" ? "rgb(0,0,0)" : color,
        size: tool === "eraser" ? eraserSize : brushSize,
        points: [{ x, y }],
        startX: x,
        startY: y,
        endX: x,
        endY: y,
      }

      setCurrentElement(newElement)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentElement) return
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (currentElement.type === "brush" || currentElement.type === "eraser") {
        setCurrentElement((prev) => ({
          ...prev!,
          points: [...prev!.points!, { x, y }],
        }))
      } else {
        setCurrentElement((prev) => ({
          ...prev!,
          endX: x,
          endY: y,
        }))
      }

      redrawCanvas()
    }
  }

  const stopDrawing = () => {
    if (!isDrawing || !currentElement) return
    setIsDrawing(false)
    setDrawingElements((prev) => [...prev, currentElement])
    setCurrentElement(null)
    saveCanvasState()
  }

  const redrawCanvas = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.lineCap = "round"
        ctx.lineJoin = "round"

        drawingElements.forEach((element) => drawElement(ctx, element))
        if (currentElement) {
          drawElement(ctx, currentElement)
        }
      }
    }
  }

  const drawElement = (ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    ctx.strokeStyle = element.color
    ctx.lineWidth = element.size

    if (element.type === "brush" || element.type === "eraser") {
      ctx.globalCompositeOperation = element.type === "eraser" ? "destination-out" : "source-over"
      ctx.beginPath()
      element.points!.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      })
      ctx.stroke()
    } else {
      ctx.globalCompositeOperation = "source-over"
      ctx.beginPath()
      if (element.type === "line") {
        ctx.moveTo(element.startX!, element.startY!)
        ctx.lineTo(element.endX!, element.endY!)
      } else if (element.type === "rectangle") {
        ctx.strokeRect(
          Math.min(element.startX!, element.endX!),
          Math.min(element.startY!, element.endY!),
          Math.abs(element.endX! - element.startX!),
          Math.abs(element.endY! - element.startY!),
        )
      } else if (element.type === "circle") {
        const radius = Math.sqrt(
          Math.pow(element.endX! - element.startX!, 2) + Math.pow(element.endY! - element.startY!, 2),
        )
        ctx.arc(element.startX!, element.startY!, radius, 0, Math.PI * 2)
      }
      ctx.stroke()
    }
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
            <Tooltip label="Reset" position="top" withArrow>
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
            </Tooltip>
              <Tooltip label="Undo" position="top" withArrow>
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
              </Tooltip>
            </div>

            <Group className="flex items-center space-x-1">
              {SWATCHES.map((swatch) => (
                <ColorSwatch
                  key={swatch}
                  color={swatch}
                  onClick={() => setColor(swatch)}
                  className="cursor-pointer hover:scale-110 transition-transform w-6 h-6"
                />
              ))}
            </Group>

            <div className="flex items-center space-x-2">
              <label htmlFor="brush-size" className="text-sm">
                Brush:
              </label>
              <input
                id="brush-size"
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24"
              />
              <label htmlFor="eraser-size" className="text-sm">
                Eraser:
              </label>
              <input
                id="eraser-size"
                type="range"
                min="5"
                max="50"
                value={eraserSize}
                onChange={(e) => setEraserSize(Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Tooltip label="Brush" position="top" withArrow>
              <Button
                onClick={() => setTool("brush")}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                      : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                  } transition-colors`}
                variant={tool === "brush" ? "default" : "ghost"}
              >
                <Brush className="w-5 h-5" />
              </Button>
              </Tooltip>
              <Tooltip label="Eraser" position="top" withArrow>
              <Button
                onClick={() => setTool("eraser")}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                      : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                  } transition-colors`}
                variant={tool === "eraser" ? "default" : "ghost"}
              >
                <Eraser className="w-5 h-5" />
              </Button>
              </Tooltip>
              <Tooltip label="Line Shape " position="top" withArrow>
              <Button
                onClick={() => setTool("line")}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                      : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                  } transition-colors`}
                variant={tool === "line" ? "default" : "ghost"}
              >
                <Minus className="w-5 h-5" />
              </Button>
              </Tooltip>
              <Tooltip label="Rectangle Shape" position="top" withArrow>
              <Button
                onClick={() => setTool("rectangle")}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                      : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                  } transition-colors`}
                variant={tool === "rectangle" ? "default" : "ghost"}
              >
                <Square className="w-5 h-5" />
              </Button>
              </Tooltip>
              <Tooltip label="Circle Shape" position="top" withArrow>
              <Button
                onClick={() => setTool("circle")}
                className={`
                  ${
                    theme === "dark"
                      ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                      : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                  } transition-colors`}
                variant={tool === "circle" ? "default" : "ghost"}
              >
                <Circle className="w-5 h-5" />
              </Button>
              </Tooltip>
            </div>
                  <Tooltip label="Change Theme" position="top" withArrow>
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
            </Tooltip>
            <Tooltip label="Convert canvas into text / Calulate" position="top" withArrow>
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
            </Tooltip>
          </div>
        </div>
      )}

      <div
        className={`fixed left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 transition-all duration-300 
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
                repeat: Number.POSITIVE_INFINITY,
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
                repeat: Number.POSITIVE_INFINITY,
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
          <div className="flex justify-between items-center">
            <div className="latex-content">{latex.text}</div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setLatexExpression((prev) => prev.filter((_, i) => i !== index))
              }}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              &#x2716;
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

