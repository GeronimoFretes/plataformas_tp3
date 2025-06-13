"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion } from "framer-motion"

export default function CrearPersonaje() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [isGenerating, setGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [inputMode, setInputMode] = useState<"upload" | "camera">("upload")
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [showSnapshotPreview, setShowSnapshotPreview] = useState(false)
  const [snapshotBlob, setSnapshotBlob] = useState<Blob | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validar tamaño (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setFileError("El archivo debe ser una imagen de hasta 5 MB.")
      setFile(null)
      setFilePreview(null)
      return
    }

    // Validar tipo
    if (!selectedFile.type.startsWith("image/")) {
      setFileError("El archivo debe ser una imagen de hasta 5 MB.")
      setFile(null)
      setFilePreview(null)
      return
    }

    setFileError(null)
    setFile(selectedFile)

    // Crear preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setFilePreview(e.target?.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.files?.length) {
      const droppedFile = e.dataTransfer.files[0]

      // Validar tamaño (max 5MB)
      if (droppedFile.size > 5 * 1024 * 1024) {
        setFileError("El archivo debe ser una imagen de hasta 5 MB.")
        return
      }

      // Validar tipo
      if (!droppedFile.type.startsWith("image/")) {
        setFileError("El archivo debe ser una imagen de hasta 5 MB.")
        return
      }

      setFileError(null)
      setFile(droppedFile)

      // Crear preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setFilePreview(e.target?.result as string)
      }
      reader.readAsDataURL(droppedFile)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleModeChange = (mode: "upload" | "camera") => {
    setInputMode(mode)

    if (mode === "camera") {
      // Reset camera states
      setCameraError(null)
      setCameraReady(false)
      setCameraLoading(true)
      setShowSnapshotPreview(false)
      setSnapshotBlob(null)

      // Initialize camera with a slight delay to ensure UI updates first
      setTimeout(() => {
        initCamera()
      }, 100)
    } else {
      // Stop camera if active
      stopCamera()
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })
      streamRef.current = null
    }

    // Reset video element
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setCameraReady(false)
    setCameraLoading(false)
  }

  const initCamera = async () => {
    console.log("Initializing camera...")

    // Stop any existing stream first
    stopCamera()

    try {
      setCameraLoading(true)
      setCameraError(null)

      // Request camera access with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })

      console.log("Camera stream obtained:", stream)
      streamRef.current = stream

      // Make sure we have a valid video element
      if (!videoRef.current) {
        throw new Error("Video element not found")
      }

      // Connect stream to video element
      videoRef.current.srcObject = stream

      // Set up event listeners for the video element
      videoRef.current.onloadedmetadata = () => {
        console.log("Video metadata loaded")
        if (videoRef.current) {
          videoRef.current
            .play()
            .then(() => {
              console.log("Camera is now playing")
              setCameraReady(true)
              setCameraLoading(false)
            })
            .catch((err) => {
              console.error("Error playing video:", err)
              setCameraError("Error al reproducir el video: " + err.message)
              setCameraLoading(false)
            })
        }
      }

      videoRef.current.onerror = (event) => {
        console.error("Video element error:", event)
        setCameraError("Error en el elemento de video")
        setCameraLoading(false)
      }
    } catch (err) {
      console.error("Camera initialization error:", err)
      setCameraReady(false)
      setCameraLoading(false)

      // Provide specific error messages
      if (err.name === "NotAllowedError") {
        setCameraError("Acceso a la cámara denegado. Por favor, permite el acceso a la cámara en tu navegador.")
      } else if (err.name === "NotFoundError") {
        setCameraError("No se encontró ninguna cámara. Verifica que tu dispositivo tenga una cámara conectada.")
      } else if (err.name === "NotReadableError") {
        setCameraError(
          "La cámara está en uso por otra aplicación. Cierra otras aplicaciones que puedan estar usando la cámara.",
        )
      } else {
        setCameraError(`Error al acceder a la cámara: ${err.message || "Desconocido"}`)
      }
    }
  }

  const handleSnapshot = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) {
      setCameraError("La cámara no está lista para tomar una foto")
      return
    }

    try {
      const video = videoRef.current
      const canvas = canvasRef.current

      // Set canvas dimensions to match video dimensions
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw the current video frame to the canvas
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        setCameraError("No se pudo acceder al contexto del canvas")
        return
      }

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setSnapshotBlob(blob)
            setShowSnapshotPreview(true)
            setCameraError(null)
          } else {
            setCameraError("No se pudo capturar la imagen")
          }
        },
        "image/jpeg",
        0.9,
      )
    } catch (err) {
      console.error("Error taking snapshot:", err)
      setCameraError(`Error al tomar la foto: ${err.message || "Desconocido"}`)
    }
  }

  const handleUseSnapshot = () => {
    if (!snapshotBlob) return

    // Crear un File a partir del Blob
    const fileFromCam = new File([snapshotBlob], "webcam.png", { type: "image/png" })
    setFile(fileFromCam)
    setFilePreview(URL.createObjectURL(snapshotBlob))
    setFileError(null)

    // Detener la cámara
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    // Volver al modo de subida
    setInputMode("upload")
  }

  const handleRetakePhoto = () => {
    setShowSnapshotPreview(false)
    setSnapshotBlob(null)

    // If camera stream was stopped, restart it
    if (!streamRef.current && inputMode === "camera") {
      initCamera()
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    if (e.target.value.trim()) {
      setNameError(null)
    }
  }

  async function handleGenerate() {
    if (!file && !snapshotBlob) return

    // clean-up UI state
    setError(null)
    setAvatarUrl(null) // remove stale avatar while we load a new one
    setGenerating(true)

    try {
      const formData = new FormData()
      if (file) {
        formData.append("image", file)
      } else if (snapshotBlob) {
        formData.append("image", snapshotBlob, "snapshot.png")
      }

      const res = await fetch("/api/generate-head-soccer", {
        method: "POST",
        body: formData,
      })

      // try to read JSON no matter what — the route always returns JSON
      const payload = await res.json().catch(() => null)

      if (!res.ok || !payload?.url) {
        // backend sends { error: "..." } on failure — bubble it up if present
        const msg = payload?.error || `Error ${res.status}: ${res.statusText || "Unknown error"}`
        throw new Error(msg)
      }

      setAvatarUrl(payload.url as string)
    } catch (err: any) {
      console.error("Error generating avatar:", err)
      // Show the exact message if it's something meaningful, else fallback
      const msg =
        typeof err?.message === "string" && err.message.length < 120
          ? err.message
          : "La generación del avatar falló. Intenta de nuevo."
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  function handleSave() {
    // Validar nombre
    if (!name.trim()) {
      setNameError("El nombre es obligatorio")
      return
    }

    // Validar avatar
    if (!avatarUrl) {
      setError("Debes generar un avatar primero")
      return
    }

    // Guardar personaje
    const id = crypto.randomUUID()
    localStorage.setItem("hs-character", JSON.stringify({ id, name, avatarUrl }))

    // Redirigir a la página principal
    router.replace(`/`)
  }

  useEffect(() => {
    // Initialize camera if in camera mode
    if (inputMode === "camera" && !cameraReady && !cameraLoading) {
      initCamera()
    }

    // Cleanup function
    return () => {
      stopCamera()
    }
  }, [inputMode])

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-4 relative overflow-hidden">
      {/* Efectos de fondo similares al juego principal */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-8 left-0 w-32 h-32 bg-purple-300 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-8 right-0 w-32 h-32 bg-pink-300 rounded-full opacity-20 animate-pulse"></div>
      </div>

      {/* Barra de navegación */}
      <div className="w-full max-w-3xl flex items-center justify-between mb-8">
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="bg-black/50 text-white border-white hover:bg-white/10"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
          Crear tu personaje
        </h1>
        <div className="w-24"></div> {/* Espaciador para centrar el título */}
      </div>

      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Panel de vista previa */}
        <div className="flex flex-col items-center">
          <div className="w-64 h-64 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 p-2 mb-4 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full h-full rounded-full overflow-hidden border-8 border-purple-500/50"
              >
                <img
                  src={avatarUrl || "/placeholder.svg"}
                  alt="Avatar generado"
                  className="w-full h-full object-cover"
                />
              </motion.div>
            ) : filePreview ? (
              <div className="w-full h-full rounded-full overflow-hidden border-8 border-gray-500/50">
                <img
                  src={filePreview || "/placeholder.svg"}
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-full rounded-full overflow-hidden border-8 border-gray-500/50 bg-gray-800 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-32 w-32 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Nombre del personaje debajo de la vista previa */}
          {name && <div className="text-2xl font-bold text-white mb-4">{name}</div>}
        </div>

        {/* Formulario */}
        <Card className="p-6 bg-gradient-to-b from-gray-900/90 to-black/90 backdrop-blur border-2 border-purple-400 shadow-2xl">
          <form className="space-y-6">
            {/* Campo de nombre */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">
                Nombre
              </Label>
              <Input
                id="name"
                placeholder="Ingresa un apodo..."
                value={name}
                onChange={handleNameChange}
                maxLength={18}
                className={`bg-gray-800 border-2 ${nameError ? "border-red-500" : "border-gray-600"} text-white`}
              />
              {nameError && <p className="text-red-500 text-sm">{nameError}</p>}
            </div>

            {/* Selector de modo de entrada */}
            <div className="space-y-2">
              <Label className="text-white">Foto</Label>

              <div className="bg-gray-800 rounded-full p-1 flex mb-2">
                <button
                  type="button"
                  onClick={() => handleModeChange("upload")}
                  className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                    inputMode === "upload"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  Subir archivo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleModeChange("camera")
                    // Reset camera error state when explicitly clicking the camera button
                    setCameraError(null)
                    setCameraReady(false)
                  }}
                  className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                    inputMode === "camera"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  Usar cámara
                </button>
              </div>

              {/* Panel de subida de archivos */}
              {inputMode === "upload" && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className={`border-2 border-dashed ${
                    fileError ? "border-red-500" : "border-gray-600"
                  } rounded-lg p-4 text-center cursor-pointer hover:border-purple-400 transition-colors`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center py-4">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-10 w-10 text-gray-400 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-gray-400">Arrastra una imagen o haz clic para seleccionar</p>
                    <Button type="button" variant="outline" className="mt-2 bg-gray-800 text-white border-purple-400">
                      Sube una selfie
                    </Button>
                  </div>

                  {filePreview && (
                    <div className="mt-2 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-md overflow-hidden">
                        <img
                          src={filePreview || "/placeholder.svg"}
                          alt="Vista previa"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Panel de cámara web */}
              {inputMode === "camera" && (
                <div className="flex flex-col items-center">
                  <div className="w-64 h-64 rounded-full overflow-hidden border-8 border-gray-500/50 bg-gray-800 flex items-center justify-center relative">
                    {/* Loading indicator */}
                    {cameraLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
                        <div className="flex flex-col items-center">
                          <svg
                            className="animate-spin h-10 w-10 text-white mb-2"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span className="text-white text-sm">Iniciando cámara...</span>
                        </div>
                      </div>
                    )}

                    {/* Camera error state */}
                    {cameraError && !showSnapshotPreview && !cameraLoading && (
                      <div className="text-red-400 text-center p-4">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-12 w-12 mx-auto mb-2 text-red-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <p className="text-sm">{cameraError}</p>
                        <button
                          type="button"
                          onClick={() => initCamera()}
                          className="mt-2 px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-md hover:bg-red-500/30"
                        >
                          Reintentar
                        </button>
                      </div>
                    )}

                    {/* Camera video feed */}
                    {!showSnapshotPreview && (
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${cameraReady ? "block" : "hidden"}`}
                      />
                    )}

                    {/* Snapshot preview */}
                    {showSnapshotPreview && snapshotBlob && (
                      <img
                        src={URL.createObjectURL(snapshotBlob) || "/placeholder.svg"}
                        alt="Captura de cámara"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Camera controls */}
                  <div className="mt-4 flex gap-2 justify-center">
                    {!showSnapshotPreview ? (
                      <Button
                        type="button"
                        onClick={handleSnapshot}
                        disabled={!cameraReady || cameraLoading}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold"
                      >
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {cameraReady ? "Tomar foto" : "Esperando cámara..."}
                      </Button>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRetakePhoto}
                          className="border-2 border-purple-400 text-white"
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 01-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Reintentar
                        </Button>
                        <Button
                          type="button"
                          onClick={handleUseSnapshot}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold"
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Usar esta foto
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Debug info - only in development */}
                  {process.env.NODE_ENV === "development" && (
                    <div className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-400">
                      <div>Estado: {cameraLoading ? "Cargando" : cameraReady ? "Lista" : "No disponible"}</div>
                      {videoRef.current && (
                        <div>
                          Dimensiones: {videoRef.current.videoWidth}x{videoRef.current.videoHeight}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Canvas oculto para procesar la imagen de la cámara */}
              <canvas ref={canvasRef} className="hidden" />

              {fileError && <p className="text-red-500 text-sm">{fileError}</p>}
              {cameraError && <p className="text-red-500 text-sm">{cameraError}</p>}
            </div>

            {/* Botón para generar avatar */}
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={(!file && !snapshotBlob) || isGenerating}
              className="w-full md:w-56 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold"
            >
              {isGenerating ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Generando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Generar avatar
                </>
              )}
            </Button>

            {/* Botón para guardar y jugar */}
            <Button
              type="button"
              onClick={handleSave}
              disabled={!avatarUrl || !name.trim()}
              className="w-full md:w-56 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Guardar y jugar
            </Button>

            {/* Mensaje de error general */}
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500 rounded-md text-red-500 text-sm">{error}</div>
            )}

            {/* Texto de ayuda */}
            <p className="text-xs text-gray-400 mt-4">
              Las imágenes sólo se envían a Replicate para su procesamiento. No almacenamos datos personales.
            </p>
          </form>
        </Card>
      </div>
    </div>
  )
}
