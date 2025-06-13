"use client"

import { RadioGroup } from "@/components/ui/radio-group"

import { TabsContent } from "@/components/ui/tabs"

import { TabsTrigger } from "@/components/ui/tabs"

import { TabsList } from "@/components/ui/tabs"

import { Tabs } from "@/components/ui/tabs"

import { Button } from "@/components/ui/button"

import { Card } from "@/components/ui/card"

import { useEffect, useRef, useState, useCallback } from "react"

// Tipos de datos del juego
interface Player {
  id: string
  name: string
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  onGround: boolean
  facingRight: boolean
  kicking: boolean
  kickTimer: number
  hitCeiling: boolean
  headImage?: string
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  rotation: number
  clones?: Ball[]
}

interface GameState {
  mode: "menu" | "options" | "playing" | "paused" | "gameOver" | "tournament" | "tournamentSelect" | "bracket"
  player1: Player
  player2: Player
  ball: Ball
  score: { player1: number; player2: 0 }
  timeLeft: number
  gameTime: number
  round: number
  tournamentWins: number
  tournamentStage: "octavos" | "cuartos" | "semifinal" | "final"
  tournamentTeams: string[]
  tournamentBracket: any
  currentMatch: number
  celebrationActive: boolean
  celebrationTimer: number
  celebrationScorer: "player1" | "player2" | null
  screenShake: { x: number; y: number; intensity: number }
  durationType: "time" | "goals"
  goalLimit: number
}

// Jugadores estrella REALES por país
const CHARACTERS = [
  {
    id: "messi",
    name: "Messi",
    headImage: "https://i.imgur.com/ubk9HaK.png",
  },
  {
    id: "maradona",
    name: "Maradona",
    headImage: "https://i.imgur.com/Opq6zxl.png",
  },
  {
    id: "mirtha",
    name: "Mirtha",
    headImage: "https://i.imgur.com/OPnw7g0.png",
  },
  {
    id: "francisco",
    name: "Francisco",
    headImage: "/francisco-head.png",
  },
  {
    id: "charly",
    name: "Charly",
    headImage: "https://i.imgur.com/Ik6tgCi.png",
  },
  {
    id: "rickyfort",
    name: "Ricky Fort",
    headImage: "https://i.imgur.com/40eMUrh.png",
  },
  {
    id: "francella",
    name: "Francella",
    headImage: "https://i.imgur.com/wGf4Sno.png",
  },
  {
    id: "darin",
    name: "Darín",
    headImage: "https://i.imgur.com/lhjvy3V.png",
  },
]

// Constantes del juego
const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 400
const GROUND_Y = 320
// Arcos 15% más grandes
const GOAL_WIDTH = 86 // Increased from 69 (25% larger)
const GOAL_HEIGHT = 115 // Increased from 92 (25% larger)
const PLAYER_SPEED = 5
const JUMP_POWER = 12
const GRAVITY = 0.5
const BALL_BOUNCE = 0.7 // Reducido de 0.9 a 0.7 para menos rebote
const BALL_INITIAL_HEIGHT = GROUND_Y - 100
const KICK_FORCE = 18 // Aumentado de 15 a 18 para mejorar la patada
const PLAYER_PUSH_FORCE = 6
// Cambiar la duración del partido de 90 a 60 segundos
const DEFAULT_GAME_DURATION = 60

// Opciones de duración del juego
const TIME_OPTIONS = [
  { label: "30 segundos", value: 30 },
  { label: "1 minuto", value: 60 },
  { label: "1 minuto 30 segundos", value: 90 },
  { label: "2 minutos", value: 120 },
]

const GOAL_OPTIONS = [
  { label: "3 goles", value: 3 },
  { label: "5 goles", value: 5 },
  { label: "10 goles", value: 10 },
  { label: "15 goles", value: 15 },
]

// Estructura del torneo
const TOURNAMENT_STAGES = {
  cuartos: {
    name: "Cuartos de Final",
    matches: 4,
    nextStage: "semifinal",
  },
  semifinal: {
    name: "Semifinal",
    matches: 2,
    nextStage: "final",
  },
  final: {
    name: "Final",
    matches: 1,
    nextStage: null,
  },
}

export default function HeadSoccerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const keysRef = useRef<Set<string>>(new Set())
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)
  const headImagesRef = useRef<Record<string, HTMLImageElement | null>>({})
  const cleatImageRef = useRef<HTMLImageElement | null>(null)
  const ballImageRef = useRef<HTMLImageElement | null>(null)
  const goalImageRef = useRef<HTMLImageElement | null>(null)

  const [selectedPlayer1, setSelectedPlayer1] = useState(CHARACTERS[0])
  const [selectedPlayer2, setSelectedPlayer2] = useState(CHARACTERS[1])
  const [gameMode, setGameMode] = useState<"quick" | "worldCup" | "multiplayer">("quick")
  const [tournamentPlayer, setTournamentPlayer] = useState<(typeof CHARACTERS)[0]>(CHARACTERS[0])

  // Nuevas opciones de duración del juego
  const [durationType, setDurationType] = useState<"time" | "goals">("time")
  const [selectedTime, setSelectedTime] = useState<number>(60) // 1 minuto por defecto
  const [selectedGoals, setSelectedGoals] = useState<number>(5) // 5 goles por defecto

  // Cargar personaje guardado del localStorage
  useEffect(() => {
    try {
      const savedCharacter = localStorage.getItem("hs-character")
      if (savedCharacter) {
        const character = JSON.parse(savedCharacter)
        // Agregar el personaje personalizado a la lista de personajes
        const customCharacter = {
          id: character.id,
          name: character.name,
          headImage: character.avatarUrl,
        }

        // Verificar si ya existe en la lista
        if (!CHARACTERS.some((c) => c.id === customCharacter.id)) {
          CHARACTERS.push(customCharacter)
          // Seleccionar automáticamente el personaje creado
          setSelectedPlayer1(customCharacter)
        }
      }
    } catch (error) {
      console.error("Error loading saved character:", error)
    }
  }, [])

  const [gameState, setGameState] = useState<GameState>({
    mode: "menu",
    player1: createPlayer(CHARACTERS[0], 150, GROUND_Y - 60, true),
    player2: createPlayer(CHARACTERS[1], CANVAS_WIDTH - 150, GROUND_Y - 60, false),
    ball: createBall(),
    score: { player1: 0, player2: 0 },
    timeLeft: DEFAULT_GAME_DURATION,
    gameTime: 0,
    round: 1,
    tournamentWins: 0,
    tournamentStage: "cuartos",
    tournamentTeams: [],
    tournamentBracket: {},
    currentMatch: 0,
    celebrationActive: false,
    celebrationTimer: 0,
    celebrationScorer: null,
    screenShake: { x: 0, y: 0, intensity: 0 },
    durationType: "time",
    goalLimit: 5,
  })

  // Cargar imagen de fondo y cabeza
  useEffect(() => {
    const img = new Image()
    img.src = "/stadium-background.png"
    img.crossOrigin = "anonymous"
    img.onload = () => {
      backgroundImageRef.current = img
    }

    // Cargar imágenes de cabezas para cada personaje
    CHARACTERS.forEach((character) => {
      if (character.headImage) {
        const headImg = new Image()
        headImg.src = character.headImage
        headImg.crossOrigin = "anonymous"
        headImg.onload = () => {
          headImagesRef.current[character.id] = headImg
        }
      }
    })

    // Cargar imagen de botín de fútbol
    const cleatImg = new Image()
    cleatImg.src = "/soccer-cleat.png"
    cleatImg.crossOrigin = "anonymous"
    cleatImg.onload = () => {
      cleatImageRef.current = cleatImg
    }

    // Cargar imagen de pelota Jabulani
    const ballImg = new Image()
    ballImg.src = "/jabulani-ball.png"
    ballImg.crossOrigin = "anonymous"
    ballImg.onload = () => {
      ballImageRef.current = ballImg
    }

    // Cargar imagen de arco de fútbol
    const goalImg = new Image()
    goalImg.src = "/soccer-goal.png"
    goalImg.crossOrigin = "anonymous"
    goalImg.onload = () => {
      goalImageRef.current = goalImg
    }
  }, [])

  // Create crowd cheer sound effect
  const crowdCheerRef = useRef<HTMLAudioElement | null>(null)
  // Referencia para el sonido de gol de Messi
  const messiGoalSoundRef = useRef<HTMLAudioElement | null>(null)
  // Flag para controlar si el sonido de Messi está reproduciéndose
  const messiSoundPlayingRef = useRef<boolean>(false)
  // Add the Francisco sound reference after the Messi sound reference (around line 1000)
  const franciscoGoalSoundRef = useRef<HTMLAudioElement | null>(null)
  // Flag to control if Francisco's sound is playing
  const franciscoSoundPlayingRef = useRef<boolean>(false)
  // Add the Maradona sound reference after the Francisco sound reference (around line 1003)
  const maradonaGoalSoundRef = useRef<HTMLAudioElement | null>(null)
  // Flag to control if Maradona's sound is playing
  const maradonaSoundPlayingRef = useRef<boolean>(false)
  // Add the Ricky Fort sound reference
  const rickyfortGoalSoundRef = useRef<HTMLAudioElement | null>(null)
  // Flag to control if Ricky Fort's sound is playing
  const rickyfortSoundPlayingRef = useRef<boolean>(false)
  // Add the Darín sound reference
  const darinGoalSoundRef = useRef<HTMLAudioElement | null>(null)
  // Flag to control if Darín's sound is playing
  const darinSoundPlayingRef = useRef<boolean>(false)
  // Add the Francella sound reference after the Darín sound reference (around line 1007)
  const francellaGoalSoundRef = useRef<HTMLAudioElement | null>(null)
  // Flag to control if Francella's sound is playing
  const francellaSoundPlayingRef = useRef<boolean>(false)
  // Add the Mirtha sound reference
  const mirthaGoalSoundRef = useRef<HTMLAudioElement | null>(null)
  // Flag to control if Mirtha's sound is playing
  const mirthaSoundPlayingRef = useRef<boolean>(false)

  // Update the useEffect that loads audio files to include Messi's sound (around line 1007)
  useEffect(() => {
    // Create a synthetic crowd cheer sound using Web Audio API
    const createCrowdCheer = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

        const playCheer = () => {
          try {
            // Create multiple oscillators for crowd effect
            const duration = 2
            const now = audioContext.currentTime

            // Low frequency rumble (crowd base)
            const rumble = audioContext.createOscillator()
            const rumbleGain = audioContext.createGain()
            rumble.frequency.setValueAtTime(80, now)
            rumble.frequency.exponentialRampToValueAtTime(60, now + duration)
            rumbleGain.gain.setValueAtTime(0.3, now)
            rumbleGain.gain.exponentialRampToValueAtTime(0.01, now + duration)
            rumble.connect(rumbleGain)
            rumbleGain.connect(audioContext.destination)
            rumble.start(now)
            rumble.stop(now + duration)

            // Mid frequency cheer
            const cheer = audioContext.createOscillator()
            const cheerGain = audioContext.createGain()
            cheer.frequency.setValueAtTime(200, now)
            cheer.frequency.exponentialRampToValueAtTime(400, now + 0.5)
            cheer.frequency.exponentialRampToValueAtTime(150, now + duration)
            cheerGain.gain.setValueAtTime(0.2, now)
            cheerGain.gain.exponentialRampToValueAtTime(0.01, now + duration)
            cheer.connect(cheerGain)
            cheerGain.connect(audioContext.destination)
            cheer.start(now)
            cheer.stop(now + duration)

            // High frequency excitement
            const excitement = audioContext.createOscillator()
            const excitementGain = audioContext.createGain()
            excitement.frequency.setValueAtTime(800, now)
            excitement.frequency.exponentialRampToValueAtTime(1200, now + 0.3)
            excitement.frequency.exponentialRampToValueAtTime(600, now + duration)
            excitementGain.gain.setValueAtTime(0.1, now)
            excitementGain.gain.exponentialRampToValueAtTime(0.01, now + duration)
            excitement.connect(excitementGain)
            excitementGain.connect(audioContext.destination)
            excitement.start(now)
            excitement.stop(now + duration)
          } catch (error) {
            console.log("Error playing synthetic crowd cheer:", error)
          }
        }

        return playCheer
      } catch (error) {
        console.log("Audio context not available:", error)
        return () => {}
      }
    }

    try {
      crowdCheerRef.current = { play: createCrowdCheer() } as any

      // Cargar el sonido de gol de Messi
      const messiSound = new Audio("/messi-goal.mp3")
      messiSound.volume = 1.0
      messiSound.addEventListener("ended", () => {
        messiSoundPlayingRef.current = false
      })
      messiGoalSoundRef.current = messiSound

      // Cargar el sonido de gol de Francisco
      const franciscoSound = new Audio("/francisco.mp3")
      franciscoSound.volume = 1.0
      franciscoSound.addEventListener("ended", () => {
        franciscoSoundPlayingRef.current = false
      })
      franciscoGoalSoundRef.current = franciscoSound

      // Cargar el sonido de gol de Maradona
      const maradonaSound = new Audio("/marado.mp3")
      maradonaSound.volume = 1.0
      maradonaSound.addEventListener("ended", () => {
        maradonaSoundPlayingRef.current = false
      })
      maradonaGoalSoundRef.current = maradonaSound

      // Cargar el sonido de gol de Ricky Fort
      const rickyfortSound = new Audio("/ricky.mp3")
      rickyfortSound.volume = 1.0
      rickyfortSound.addEventListener("ended", () => {
        rickyfortSoundPlayingRef.current = false
      })
      rickyfortGoalSoundRef.current = rickyfortSound

      // Cargar el sonido de gol de Darín
      const darinSound = new Audio("/darin.mp3")
      darinSound.volume = 1.0
      darinSound.addEventListener("ended", () => {
        darinSoundPlayingRef.current = false
      })
      darinGoalSoundRef.current = darinSound

      // Cargar el sonido de gol de Francella
      const francellaSound = new Audio("/francella.mp3")
      francellaSound.volume = 1.0
      francellaSound.addEventListener("ended", () => {
        francellaSoundPlayingRef.current = false
      })
      francellaGoalSoundRef.current = francellaSound

      // Cargar el sonido de gol de Mirtha
      const mirthaSound = new Audio("/mirtha.mp3")
      mirthaSound.volume = 1.0
      mirthaSound.addEventListener("ended", () => {
        mirthaSoundPlayingRef.current = false
      })
      mirthaGoalSoundRef.current = mirthaSound
    } catch (error) {
      console.log("Could not create audio elements:", error)
    }
  }, [])

  // Update the triggerGoalCelebration function to play Messi's sound when he scores (around line 1060)
  const triggerGoalCelebration = (scorer: "player1" | "player2") => {
    // Determinar qué jugador marcó el gol
    const scoringPlayer = scorer === "player1" ? gameState.player1 : gameState.player2

    // Verificar si Messi marcó el gol
    if (scoringPlayer.id === "messi" && messiGoalSoundRef.current && !messiSoundPlayingRef.current) {
      // Reproducir el sonido de Messi
      try {
        messiSoundPlayingRef.current = true
        messiGoalSoundRef.current.currentTime = 0
        messiGoalSoundRef.current.play().catch((error) => {
          console.log("Error playing Messi's goal sound:", error)
          messiSoundPlayingRef.current = false
        })
      } catch (error) {
        console.log("Could not play Messi's goal sound:", error)
        messiSoundPlayingRef.current = false
      }
    }
    // Verificar si Francisco marcó el gol
    else if (scoringPlayer.id === "francisco" && franciscoGoalSoundRef.current && !franciscoSoundPlayingRef.current) {
      // Reproducir el sonido de Francisco
      try {
        franciscoSoundPlayingRef.current = true
        franciscoGoalSoundRef.current.currentTime = 0
        franciscoGoalSoundRef.current.play().catch((error) => {
          console.log("Error playing Francisco's goal sound:", error)
          franciscoSoundPlayingRef.current = false
        })
      } catch (error) {
        console.log("Could not play Francisco's goal sound:", error)
        franciscoSoundPlayingRef.current = false
      }
    }
    // Verificar si Maradona marcó el gol
    else if (scoringPlayer.id === "maradona" && maradonaGoalSoundRef.current && !maradonaSoundPlayingRef.current) {
      // Reproducir el sonido de Maradona
      try {
        maradonaSoundPlayingRef.current = true
        maradonaGoalSoundRef.current.currentTime = 0
        maradonaGoalSoundRef.current.play().catch((error) => {
          console.log("Error playing Maradona's goal sound:", error)
          maradonaSoundPlayingRef.current = false
        })
      } catch (error) {
        console.log("Could not play Maradona's goal sound:", error)
        maradonaSoundPlayingRef.current = false
      }
    }
    // Verificar si Ricky Fort marcó el gol
    else if (scoringPlayer.id === "rickyfort" && rickyfortGoalSoundRef.current && !rickyfortSoundPlayingRef.current) {
      // Reproducir el sonido de Ricky Fort
      try {
        rickyfortSoundPlayingRef.current = true
        rickyfortGoalSoundRef.current.currentTime = 0
        rickyfortGoalSoundRef.current.play().catch((error) => {
          console.log("Error playing Ricky Fort's goal sound:", error)
          rickyfortSoundPlayingRef.current = false
        })
      } catch (error) {
        console.log("Could not play Ricky Fort's goal sound:", error)
        rickyfortSoundPlayingRef.current = false
      }
    }
    // Verificar si Darín marcó el gol
    else if (scoringPlayer.id === "darin" && darinGoalSoundRef.current && !darinSoundPlayingRef.current) {
      // Reproducir el sonido de Darín
      try {
        darinSoundPlayingRef.current = true
        darinGoalSoundRef.current.currentTime = 0
        darinGoalSoundRef.current.play().catch((error) => {
          console.log("Error playing Darín's goal sound:", error)
          darinSoundPlayingRef.current = false
        })
      } catch (error) {
        console.log("Could not play Darín's goal sound:", error)
        darinSoundPlayingRef.current = false
      }
    }
    // Verificar si Francella marcó el gol
    else if (scoringPlayer.id === "francella" && francellaGoalSoundRef.current && !francellaSoundPlayingRef.current) {
      // Reproducir el sonido de Francella
      try {
        francellaSoundPlayingRef.current = true
        francellaGoalSoundRef.current.currentTime = 0
        francellaGoalSoundRef.current.play().catch((error) => {
          console.log("Error playing Francella's goal sound:", error)
          francellaSoundPlayingRef.current = false
        })
      } catch (error) {
        console.log("Could not play Francella's goal sound:", error)
        francellaSoundPlayingRef.current = false
      }
    }
    // Verificar si Mirtha marcó el gol
    else if (scoringPlayer.id === "mirtha" && mirthaGoalSoundRef.current && !mirthaSoundPlayingRef.current) {
      // Reproducir el sonido de Mirtha
      try {
        mirthaSoundPlayingRef.current = true
        mirthaGoalSoundRef.current.currentTime = 0
        mirthaGoalSoundRef.current.play().catch((error) => {
          console.log("Error playing Mirtha's goal sound:", error)
          mirthaSoundPlayingRef.current = false
        })
      } catch (error) {
        console.log("Could not play Mirtha's goal sound:", error)
        mirthaSoundPlayingRef.current = false
      }
    } else {
      // Para otros jugadores, usar el sonido de multitud genérico
      if (crowdCheerRef.current?.play) {
        try {
          crowdCheerRef.current.play()
        } catch (error) {
          console.log("Could not play crowd cheer sound:", error)
        }
      }
    }

    setGameState((prev) => ({
      ...prev,
      celebrationActive: true,
      celebrationTimer: 90, // 1.5 seconds at 60fps
      celebrationScorer: scorer,
      screenShake: { x: 0, y: 0, intensity: 15 },
    }))
  }

  // Modificar la función createPlayer para inicializar los jugadores a la altura correcta
  function createPlayer(character: (typeof CHARACTERS)[0], x: number, y: number, facingRight: boolean): Player {
    return {
      id: character.id,
      name: character.name,
      x,
      y,
      vx: 0,
      vy: 0,
      width: 40,
      height: 60,
      onGround: true,
      facingRight,
      kicking: false,
      kickTimer: 0,
      hitCeiling: false,
      headImage: character.headImage,
    }
  }

  function createBall(): Ball {
    return {
      x: CANVAS_WIDTH / 2,
      y: BALL_INITIAL_HEIGHT,
      vx: (Math.random() - 0.5) * 4,
      vy: -5,
      radius: 15,
      rotation: 0,
      clones: [],
    }
  }

  // Inicializar torneo con lógica corregida - SOLO 1 PARTIDO POR FASE PARA EL JUGADOR
  const initTournament = () => {
    // Seleccionar 3 equipos aleatorios diferentes (excluyendo el del jugador)
    const availableTeams = CHARACTERS.filter((char) => char.id !== tournamentPlayer.id)
    const shuffledTeams = [...availableTeams].sort(() => Math.random() - 0.5).slice(0, 3)

    // Crear estructura simplificada del torneo
    const bracket = {
      cuartos: { opponent: shuffledTeams[0] },
      semifinal: { opponent: shuffledTeams[1] },
      final: { opponent: shuffledTeams[2] },
      currentStage: "cuartos",
    }

    setGameState((prev) => ({
      ...prev,
      mode: "bracket",
      tournamentStage: "cuartos",
      tournamentBracket: bracket,
    }))
  }

  // Lógica corregida: el jugador solo juega 1 partido por fase
  const advanceTournament = (winner: string) => {
    setGameState((prev) => {
      const currentStage = prev.tournamentStage
      const bracket = { ...prev.tournamentBracket }

      // Si el jugador perdió, mostrar pantalla de fin de torneo
      if (winner !== tournamentPlayer.id) {
        return {
          ...prev,
          mode: "gameOver",
        }
      }

      // El jugador ganó, avanzar a la siguiente fase
      let nextStage = currentStage
      if (currentStage === "cuartos") {
        nextStage = "semifinal"
      } else if (currentStage === "semifinal") {
        nextStage = "final"
      } else if (currentStage === "final") {
        // El jugador ganó el torneo
        return {
          ...prev,
          mode: "gameOver",
          tournamentBracket: {
            ...bracket,
            champion: winner,
          },
        }
      }

      // Actualizar la etapa actual
      bracket.currentStage = nextStage

      return {
        ...prev,
        tournamentStage: nextStage,
        tournamentBracket: bracket,
        mode: "bracket",
      }
    })
  }

  // El jugador siempre juega contra su oponente directo en su partido asignado
  // Modificar la función startTournamentMatch para inicializar los jugadores a la altura correcta
  const startTournamentMatch = () => {
    const currentStage = gameState.tournamentStage
    const opponent = gameState.tournamentBracket[currentStage].opponent

    setGameState((prev) => ({
      ...prev,
      mode: "playing",
      player1: createPlayer(tournamentPlayer, 150, GROUND_Y - 60, true),
      player2: createPlayer(opponent, CANVAS_WIDTH - 150, GROUND_Y - 60, false),
      ball: createBall(),
      score: { player1: 0, player2: 0 },
      timeLeft: DEFAULT_GAME_DURATION,
      gameTime: 0,
      durationType: "time", // El modo Copa Mundial siempre usa tiempo
      goalLimit: 5, // Valor por defecto, no se usa en modo Copa Mundial
    }))
  }

  // Manejo de controles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase())
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase())
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [])

  const gameLoop = useCallback(() => {
    if (gameState.mode !== "playing") return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    updateGame()
    render(ctx)

    animationRef.current = requestAnimationFrame(gameLoop)
  }, [gameState])

  // Modificar la función updatePhysics para ajustar la posición de los jugadores al mismo nivel que la pelota
  const updatePhysics = (state: GameState) => {
    // Actualizar la posición de los jugadores
    state.player1.x += state.player1.vx
    state.player1.y += state.player1.vy
    state.player2.x += state.player2.vx
    state.player2.y += state.player2.vy

    // Aplicar gravedad a los jugadores
    if (state.player1.y < GROUND_Y - state.player1.height) {
      state.player1.vy += GRAVITY
      state.player1.onGround = false
    } else {
      // Ajustar la posición Y para que los pies estén exactamente en GROUND_Y
      state.player1.y = GROUND_Y - state.player1.height
      state.player1.vy = 0
      state.player1.onGround = true
      state.player1.hitCeiling = false
    }

    if (state.player2.y < GROUND_Y - state.player2.height) {
      state.player2.vy += GRAVITY
      state.player2.onGround = false
    } else {
      // Ajustar la posición Y para que los pies estén exactamente en GROUND_Y
      state.player2.y = GROUND_Y - state.player2.height
      state.player2.vy = 0
      state.player2.onGround = true
      state.player2.hitCeiling = false
    }

    // Actualizar la posición de la pelota
    state.ball.x += state.ball.vx
    state.ball.y += state.ball.vy

    // Aplicar gravedad a la pelota
    state.ball.vy += GRAVITY

    // Colisiones con los bordes del canvas
    if (state.ball.x - state.ball.radius < 0) {
      state.ball.x = state.ball.radius
      state.ball.vx = -state.ball.vx * BALL_BOUNCE
    }
    if (state.ball.x + state.ball.radius > CANVAS_WIDTH) {
      state.ball.x = CANVAS_WIDTH - state.ball.radius
      state.ball.vx = -state.ball.vx * BALL_BOUNCE
    }

    // Rebote de la pelota con el suelo
    if (state.ball.y + state.ball.radius > GROUND_Y) {
      state.ball.y = GROUND_Y - state.ball.radius
      state.ball.vy = -state.ball.vy * BALL_BOUNCE
      state.ball.vx *= 0.9
    }

    // Rebote de la pelota con el techo
    if (state.ball.y - state.ball.radius < 0) {
      state.ball.y = state.ball.radius
      state.ball.vy = -state.ball.vy * BALL_BOUNCE
    }

    // Colisiones con los travesaños de los arcos
    const goalHeight = GROUND_Y - GOAL_HEIGHT
    const crossbarThickness = 5 // Grosor del travesaño

    // Travesaño izquierdo
    if (
      state.ball.x - state.ball.radius < GOAL_WIDTH &&
      state.ball.x + state.ball.radius > 0 &&
      Math.abs(state.ball.y - goalHeight) < state.ball.radius + crossbarThickness / 2
    ) {
      // Rebote con el travesaño izquierdo
      state.ball.y =
        goalHeight +
        (state.ball.y < goalHeight
          ? -state.ball.radius - crossbarThickness / 2
          : state.ball.radius + crossbarThickness / 2)
      state.ball.vy = -state.ball.vy * BALL_BOUNCE
    }

    // Travesaño derecho
    if (
      state.ball.x + state.ball.radius > CANVAS_WIDTH - GOAL_WIDTH &&
      state.ball.x - state.ball.radius < CANVAS_WIDTH &&
      Math.abs(state.ball.y - goalHeight) < state.ball.radius + crossbarThickness / 2
    ) {
      // Rebote con el travesaño derecho
      state.ball.y =
        goalHeight +
        (state.ball.y < goalHeight
          ? -state.ball.radius - crossbarThickness / 2
          : state.ball.radius + crossbarThickness / 2)
      state.ball.vy = -state.ball.vy * BALL_BOUNCE
    }
  }

  const updateGame = () => {
    setGameState((prevState) => {
      const newState = { ...prevState }

      // Handle goal celebration
      if (newState.celebrationActive) {
        newState.celebrationTimer--

        // Update screen shake
        if (newState.screenShake.intensity > 0) {
          newState.screenShake.x = (Math.random() - 0.5) * newState.screenShake.intensity
          newState.screenShake.y = (Math.random() - 0.5) * newState.screenShake.intensity
          newState.screenShake.intensity *= 0.95 // Decay shake intensity
        }

        // End celebration
        if (newState.celebrationTimer <= 0) {
          newState.celebrationActive = false
          newState.celebrationScorer = null
          newState.screenShake = { x: 0, y: 0, intensity: 0 }

          // Reset positions
          resetBall(newState)
        }

        // Don't update game physics during celebration
        return newState
      }

      // Actualizar tiempo de juego
      if (newState.durationType === "time") {
        newState.gameTime += 1 / 60
        newState.timeLeft = Math.max(0, selectedTime - newState.gameTime)
      }

      updatePlayerControls(newState.player1, {
        left: keysRef.current.has("a"),
        right: keysRef.current.has("d"),
        jump: keysRef.current.has("w"),
        kick: keysRef.current.has(" "),
      })

      if (gameMode === "multiplayer") {
        updatePlayerControls(newState.player2, {
          left: keysRef.current.has("arrowleft"),
          right: keysRef.current.has("arrowright"),
          jump: keysRef.current.has("arrowup"),
          kick: keysRef.current.has("arrowdown"),
        })
      } else {
        updateAI(newState.player2, newState.ball)
      }

      updatePhysics(newState)
      checkCollisions(newState)
      checkGoals(newState)
      updateSpecialEffects(newState)

      // Actualizar rotación de la pelota basada en su velocidad
      const speed = Math.sqrt(newState.ball.vx * newState.ball.vx + newState.ball.vy * newState.ball.vy)
      newState.ball.rotation += speed * 0.05

      // Hacer lo mismo para los clones de la pelota
      if (newState.ball.clones) {
        newState.ball.clones.forEach((clone) => {
          const cloneSpeed = Math.sqrt(clone.vx * clone.vx + clone.vy * clone.vy)
          clone.rotation += cloneSpeed * 0.05
        })
      }

      // Verificar condiciones de fin de juego
      if (
        (newState.durationType === "time" && newState.timeLeft <= 0) ||
        (newState.durationType === "goals" &&
          (newState.score.player1 >= newState.goalLimit || newState.score.player2 >= newState.goalLimit))
      ) {
        newState.mode = "gameOver"

        // Si estamos en modo torneo, avanzar al siguiente partido
        if (gameMode === "worldCup") {
          // Determinar ganador
          const winner = newState.score.player1 > newState.score.player2 ? tournamentPlayer.id : newState.player2.id

          // Actualizar bracket
          advanceTournament(winner)
        }
      }

      return newState
    })
  }

  const updatePlayerControls = (player: Player, controls: any) => {
    const speed = PLAYER_SPEED

    if (controls.left && player.x > 20) {
      player.vx = -speed
      player.facingRight = false
    } else if (controls.right && player.x < CANVAS_WIDTH - 60) {
      player.vx = speed
      player.facingRight = true
    } else {
      player.vx *= 0.8
    }

    if (controls.jump && player.onGround) {
      player.vy = -JUMP_POWER
      player.onGround = false
    }

    if (controls.kick) {
      player.kicking = true
      player.kickTimer = 10
    } else {
      player.kicking = false
    }

    if (player.kickTimer > 0) {
      player.kickTimer--
    }
  }

  const updateAI = (player: Player, ball: Ball) => {
    const ballDistance = Math.abs(player.x - ball.x)
    const speed = PLAYER_SPEED

    if (ball.x < player.x - 30) {
      player.vx = -speed * 0.8
      player.facingRight = false
    } else if (ball.x > player.x + 30) {
      player.vx = speed * 0.8
      player.facingRight = true
    } else {
      player.vx *= 0.8
    }

    if (ballDistance < 60 && ball.y < player.y - 20 && player.onGround && !player.hitCeiling) {
      player.vy = -JUMP_POWER
      player.onGround = false
    }

    // Mejorar la IA para que patee más
    if (ballDistance < 50 && Math.random() < 0.2) {
      player.kicking = true
      player.kickTimer = 10
    } else {
      player.kicking = false
    }
  }

  const checkCollisions = (state: GameState) => {
    const checkPlayerBallCollision = (player: Player, ball: Ball) => {
      const headDx = ball.x - (player.x + player.width / 2)
      const headDy = ball.y - (player.y + player.height / 2)
      const headDistance = Math.sqrt(headDx * headDx + headDy * headDy)

      // Posición del pie mejorada - ahora debajo del jugador
      const footX = player.x + player.width / 2
      const footY = player.y + player.height + 10
      const footDx = ball.x - footX
      const footDy = ball.y - footY
      const footDistance = Math.sqrt(footDx * footDx + footDy * footDy)

      let collision = false

      // Colisión con la cabeza (ahora es el cuerpo principal)
      if (headDistance < ball.radius + player.width / 2) {
        collision = true
        const angle = Math.atan2(headDy, headDx)
        const force = 6
        ball.vx = Math.cos(angle) * force
        ball.vy = Math.sin(angle) * force - 2
      }
      // Colisión con el pie (más precisa)
      else if (footDistance < ball.radius + 20) {
        collision = true
        const kickPower = player.kicking ? 2.5 : 1.2
        const angle = Math.atan2(footDy, footDx)
        const force = KICK_FORCE * kickPower

        ball.vx = Math.cos(angle) * force
        ball.vy = Math.sin(angle) * force - 3

        if (player.kicking) {
          ball.vx *= 1.5
          ball.vy -= 3
        }
      }
    }

    const checkPlayerCollision = (player1: Player, player2: Player) => {
      const dx = player1.x + player1.width / 2 - (player2.x + player2.width / 2)
      const dy = player1.y + player1.height / 2 - (player2.y + player2.height / 2)
      const distance = Math.sqrt(dx * dx + dy * dy)
      const minDistance = (player1.width + player2.width) / 2

      if (distance < minDistance && distance > 0) {
        const overlap = minDistance - distance
        const separationX = (dx / distance) * overlap * 0.5
        const separationY = (dy / distance) * overlap * 0.5

        player1.x += separationX
        player1.y += separationY
        player2.x -= separationX
        player2.y -= separationY

        const pushForce = PLAYER_PUSH_FORCE * 0.5

        if (player1.kicking) {
          player2.vx += (player1.facingRight ? 1 : -1) * pushForce
          player2.vy = Math.min(-3, player2.vy - 2)
        }
        if (player2.kicking) {
          player1.vx += (player2.facingRight ? 1 : -1) * pushForce
          player1.vy = Math.min(-3, player1.vy - 2)
        }
      }
    }

    checkPlayerCollision(state.player1, state.player2)
    checkPlayerBallCollision(state.player1, state.ball)
    checkPlayerBallCollision(state.player2, state.ball)
  }

  const checkGoals = (state: GameState) => {
    const checkGoal = (ball: Ball) => {
      const goalHeight = GROUND_Y - GOAL_HEIGHT
      const hitboxTopOffset = 30 // Reducimos la altura del hitbox en 30 píxeles
      const crossbarThickness = 5 // Grosor del travesaño

      // Verificar si la pelota está tocando el travesaño izquierdo
      const touchingLeftCrossbar =
        ball.x <= GOAL_WIDTH && Math.abs(ball.y - goalHeight) <= ball.radius + crossbarThickness / 2

      // Verificar si la pelota está tocando el travesaño derecho
      const touchingRightCrossbar =
        ball.x >= CANVAS_WIDTH - GOAL_WIDTH && Math.abs(ball.y - goalHeight) <= ball.radius + crossbarThickness / 2

      // Gol en la portería izquierda (jugador 2 marca)
      if (
        ball.x <= GOAL_WIDTH &&
        ball.y > goalHeight + ball.radius + hitboxTopOffset &&
        ball.y <= GROUND_Y - ball.radius &&
        !touchingLeftCrossbar // No es gol si está tocando el travesaño
      ) {
        state.score.player2++
        triggerGoalCelebration("player2")
        console.log("⚽ ¡GOOOOOL del Jugador 2!")
        return true
      }

      // Gol en la portería derecha (jugador 1 marca)
      if (
        ball.x >= CANVAS_WIDTH - GOAL_WIDTH &&
        ball.y > goalHeight + ball.radius + hitboxTopOffset &&
        ball.y <= GROUND_Y - ball.radius &&
        !touchingRightCrossbar // No es gol si está tocando el travesaño
      ) {
        state.score.player1++
        triggerGoalCelebration("player1")
        console.log("⚽ ¡GOOOOOL del Jugador 1!")
        return true
      }

      return false
    }

    if (checkGoal(state.ball)) return
    if (state.ball.clones) {
      state.ball.clones = state.ball.clones.filter((clone) => !checkGoal(clone))
    }
  }

  // Modificar la función resetBall para posicionar correctamente a los jugadores
  const resetBall = (state: GameState) => {
    state.ball = createBall()
    state.player1.x = 150
    state.player1.y = GROUND_Y - state.player1.height
    state.player2.x = CANVAS_WIDTH - 150
    state.player2.y = GROUND_Y - state.player2.height
  }

  const updateSpecialEffects = (state: GameState) => {
    // This function can be empty now as all special effects were power-related
  }

  const drawField = (ctx: CanvasRenderingContext2D) => {
    // Usar la imagen de fondo del estadio
    if (backgroundImageRef.current) {
      ctx.drawImage(backgroundImageRef.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    } else {
      // Fondo alternativo si la imagen no está cargada
      const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
      gradient.addColorStop(0, "#87CEEB") // Cielo azul
      gradient.addColorStop(1, "#4682B4") // Azul acero
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Césped
      ctx.fillStyle = "#2E8B57" // Verde mar
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y)
    }

    // Líneas del campo más brillantes
    ctx.strokeStyle = "#FFFFFF"
    ctx.lineWidth = 4

    // Línea central
    ctx.beginPath()
    ctx.moveTo(CANVAS_WIDTH / 2, GROUND_Y)
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT)
    ctx.stroke()

    // ELIMINADO: Ya no dibujamos el círculo central

    // Porterías con imágenes de arcos
    if (goalImageRef.current) {
      // Portería izquierda
      ctx.save()
      ctx.scale(-1, 1) // Voltear horizontalmente para la portería izquierda
      ctx.drawImage(
        goalImageRef.current,
        -GOAL_WIDTH - 10,
        GROUND_Y - GOAL_HEIGHT - 10,
        GOAL_WIDTH + 20,
        GOAL_HEIGHT + 20,
      )
      ctx.restore()

      // Portería derecha
      ctx.drawImage(
        goalImageRef.current,
        CANVAS_WIDTH - GOAL_WIDTH - 10,
        GROUND_Y - GOAL_HEIGHT - 10,
        GOAL_WIDTH + 20,
        GOAL_HEIGHT + 20,
      )
    } else {
      // Fallback: porterías simples si la imagen no está cargada
      ctx.strokeStyle = "#FFFFFF"
      ctx.lineWidth = 6

      // Portería izquierda
      ctx.beginPath()
      ctx.moveTo(0, GROUND_Y)
      ctx.lineTo(0, GROUND_Y - GOAL_HEIGHT)
      ctx.lineTo(GOAL_WIDTH, GROUND_Y - GOAL_HEIGHT)
      ctx.lineTo(GOAL_WIDTH, GROUND_Y)
      ctx.stroke()

      // Portería derecha
      ctx.beginPath()
      ctx.moveTo(CANVAS_WIDTH, GROUND_Y)
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y - GOAL_HEIGHT)
      ctx.lineTo(CANVAS_WIDTH - GOAL_WIDTH, GROUND_Y - GOAL_HEIGHT)
      ctx.lineTo(CANVAS_WIDTH - GOAL_WIDTH, GROUND_Y)
      ctx.stroke()
    }
  }

  // Modificar la función drawPlayer para ajustar la posición del botín de fútbol
  const drawPlayer = (ctx: CanvasRenderingContext2D, player: Player) => {
    ctx.save()

    // Cabeza (ahora es todo el cuerpo del jugador) - 25% más grande
    const headSize = player.width * 1.5 // 1.5 = 1.2 * 1.25 (25% más grande)
    const headX = player.x + player.width / 2 - headSize / 2
    const headY = player.y + player.height / 2 - headSize / 2 + 15 // Move head down 15 pixels closer to foot

    // Get the correct head image for this player
    const headImage = player.headImage ? headImagesRef.current[player.id] : null

    if (headImage) {
      ctx.save()

      // Player 1 keeps the current horizontal flip, Player 2 gets normal orientation
      if (player.id === gameState.player1.id) {
        // Player 1: Flip horizontally
        ctx.scale(-1, 1)
        ctx.drawImage(
          headImage,
          -(headX + headSize), // Invertir X para el flip horizontal
          headY,
          headSize,
          headSize,
        )
      } else {
        // Player 2: Normal orientation (no flip)
        ctx.drawImage(headImage, headX, headY, headSize, headSize)
      }

      ctx.restore()
    } else {
      // Fallback: dibujar cabeza simple si la imagen no está cargada
      ctx.fillStyle = "#87CEEB" // Default color
      ctx.beginPath()
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, headSize / 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // Dibujar botín de fútbol - ahora debajo del jugador y 25% más pequeño
    const cleatSize = 37.5 // Reducido 25% del tamaño anterior
    const cleatX = player.x + player.width / 2 - cleatSize / 2 + 10 // Move foot 10 pixels to the right
    const cleatY = player.y + player.height

    if (cleatImageRef.current) {
      ctx.save()

      // Más movimiento en la animación de patada
      if (player.kicking) {
        // Animación de patada más dramática
        const kickAngle = player.facingRight ? -0.8 : 0.8 // Aumentado de 0.5 a 0.8
        const kickOffset = Math.sin(player.kickTimer * 0.5) * 15 // Movimiento oscilante
        ctx.translate(cleatX + cleatSize / 2 + kickOffset, cleatY + cleatSize / 2)
        ctx.rotate(kickAngle)

        // Flip cleat horizontally for player 2
        if (player.id === gameState.player2.id) {
          ctx.scale(-1, 1)
        }

        ctx.drawImage(cleatImageRef.current, -cleatSize / 2, -cleatSize / 2, cleatSize, cleatSize)
      } else {
        // Flip cleat horizontally for player 2
        if (player.id === gameState.player2.id) {
          ctx.scale(-1, 1)
          ctx.drawImage(cleatImageRef.current, -cleatX - cleatSize, cleatY, cleatSize, cleatSize)
        } else {
          ctx.drawImage(cleatImageRef.current, cleatX, cleatY, cleatSize, cleatSize)
        }
      }

      ctx.restore()
    } else {
      // Fallback: dibujar pie simple
      ctx.fillStyle = "#8B4513"
      ctx.fillRect(cleatX, cleatY, cleatSize, cleatSize * 0.6)
    }

    // Animación de patada mejorada
    if (player.kicking && player.kickTimer > 5) {
      // Efecto de impacto dorado
      ctx.strokeStyle = "#FFD700"
      ctx.lineWidth = 6
      ctx.beginPath()
      const kickX = player.x + player.width / 2
      const kickY = cleatY + cleatSize / 2
      ctx.arc(kickX, kickY, 30, 0, Math.PI * 2)
      ctx.stroke()

      // Efecto de velocidad/movimiento
      ctx.strokeStyle = "#FFFFFF"
      ctx.lineWidth = 3
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        const offsetY = 10 + i * 8
        ctx.arc(kickX, kickY + offsetY, 15 - i * 3, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Partículas de impacto
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        const particleX = kickX + Math.cos(angle) * 30
        const particleY = kickY + Math.sin(angle) * 30

        ctx.fillStyle = "#FFD700"
        ctx.beginPath()
        ctx.arc(particleX, particleY, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()
  }

  const drawBall = (ctx: CanvasRenderingContext2D, ball: Ball) => {
    ctx.save()

    // Dibujar la pelota Jabulani con rotación
    if (ballImageRef.current) {
      ctx.save()
      ctx.translate(ball.x, ball.y)
      ctx.rotate(ball.rotation)
      ctx.drawImage(ballImageRef.current, -ball.radius, -ball.radius, ball.radius * 2, ball.radius * 2)
      ctx.restore()
    } else {
      // Fallback: dibujar pelota simple si la imagen no está cargada
      ctx.fillStyle = "#FFFFFF"
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(ball.x - ball.radius, ball.y)
      ctx.lineTo(ball.x + ball.radius, ball.y)
      ctx.moveTo(ball.x, ball.y - ball.radius)
      ctx.lineTo(ball.x, ball.y + ball.radius)
      ctx.stroke()
    }

    ctx.restore()
  }

  const drawUI = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = "#FFFFFF"
    ctx.font = "bold 28px Arial"
    ctx.textAlign = "center"
    ctx.fillText(`${gameState.score.player1} - ${gameState.score.player2}`, CANVAS_WIDTH / 2, 35)

    // Mostrar tiempo o goles restantes según el modo de juego
    if (gameState.durationType === "time") {
      const minutes = Math.floor(gameState.timeLeft / 60)
      const seconds = Math.floor(gameState.timeLeft % 60)
      ctx.fillText(`${minutes}:${seconds.toString().padStart(2, "0")}`, CANVAS_WIDTH / 2, 65)
    } else {
      // Modo por goles
      const goalsToWin = gameState.goalLimit
      const player1GoalsNeeded = goalsToWin - gameState.score.player1
      const player2GoalsNeeded = goalsToWin - gameState.score.player2

      if (player1GoalsNeeded <= 0 || player2GoalsNeeded <= 0) {
        ctx.fillText("¡Fin del partido!", CANVAS_WIDTH / 2, 65)
      } else {
        ctx.fillText(`Meta: ${goalsToWin} goles`, CANVAS_WIDTH / 2, 65)
      }
    }

    ctx.font = "18px Arial"
    ctx.textAlign = "left"
    ctx.fillText(`${gameState.player1.name}`, 20, 35)
    ctx.textAlign = "right"
    ctx.fillText(`${gameState.player2.name}`, CANVAS_WIDTH - 20, 35)
  }

  const drawCelebration = (ctx: CanvasRenderingContext2D) => {
    if (!gameState.celebrationActive || !gameState.celebrationScorer) return

    const progress = 1 - gameState.celebrationTimer / 90
    const pulseScale = 1 + Math.sin(progress * Math.PI * 8) * 0.2
    const opacity = Math.max(0, 1 - progress * 0.3)

    ctx.save()

    // Semi-transparent overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 0.7})`
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // "¡GOL!" text
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Glow effect
    ctx.shadowColor = "#FFD700"
    ctx.shadowBlur = 30
    ctx.fillStyle = "#FFD700"
    ctx.font = `bold ${120 * pulseScale}px Arial`
    ctx.fillText("¡GOL!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)

    // White outline
    ctx.shadowBlur = 0
    ctx.strokeStyle = "#FFFFFF"
    ctx.lineWidth = 8
    ctx.strokeText("¡GOL!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40)

    // Scorer info
    const scorer = gameState.celebrationScorer === "player1" ? gameState.player1 : gameState.player2
    ctx.fillStyle = "#FFFFFF"
    ctx.font = `bold ${32 * pulseScale}px Arial`
    ctx.fillText(`${scorer.name}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40)

    // Celebration particles
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2
      const distance = 150 + Math.sin(progress * Math.PI * 4) * 50
      const x = CANVAS_WIDTH / 2 + Math.cos(angle) * distance
      const y = CANVAS_HEIGHT / 2 + Math.sin(angle) * distance * 0.6

      ctx.fillStyle = i % 2 === 0 ? "#FFD700" : "#FFFFFF"
      ctx.beginPath()
      ctx.arc(x, y, 8 * pulseScale, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  const drawBracket = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Fondo
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, "#1a1a2e")
    gradient.addColorStop(1, "#16213e")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Título con la fase actual
    ctx.fillStyle = "#FFD700"
    ctx.font = "bold 32px Arial"
    ctx.textAlign = "center"
    ctx.fillText(`🏆 ${TOURNAMENT_STAGES[gameState.tournamentStage].name} 🏆`, CANVAS_WIDTH / 2, 40)

    // Mostrar progreso del torneo
    ctx.fillStyle = "#FFFFFF"
    ctx.font = "16px Arial"
    ctx.textAlign = "center"
    ctx.fillText(`Copa Mundial - ${TOURNAMENT_STAGES[gameState.tournamentStage].name}`, CANVAS_WIDTH / 2, 70)

    // Dibujar el partido actual
    const currentStage = gameState.tournamentStage
    const opponent = gameState.tournamentBracket[currentStage].opponent

    const matchWidth = 400
    const matchHeight = 80
    const x = CANVAS_WIDTH / 2 - matchWidth / 2
    const y = 120

    // Recuadro del partido
    ctx.fillStyle = "rgba(255, 215, 0, 0.4)"
    ctx.strokeStyle = "#FFD700"
    ctx.lineWidth = 3
    ctx.fillRect(x, y, matchWidth, matchHeight)
    ctx.strokeRect(x, y, matchWidth, matchHeight)

    // Jugador
    ctx.fillStyle = "#FFD700"
    ctx.font = "bold 20px Arial"
    ctx.textAlign = "left"
    ctx.fillText(`${tournamentPlayer.name}`, x + 20, y + 35)

    // VS
    ctx.fillStyle = "#FF6B6B"
    ctx.font = "bold 24px Arial"
    ctx.textAlign = "center"
    ctx.fillText("VS", x + matchWidth / 2, y + 40)

    // Oponente
    ctx.fillStyle = "#FFFFFF"
    ctx.font = "bold 20px Arial"
    ctx.textAlign = "right"
    ctx.fillText(`${opponent.name}`, x + matchWidth - 20, y + 35)

    // Mostrar progreso del torneo
    ctx.fillStyle = "#FFFFFF"
    ctx.font = "16px Arial"
    ctx.textAlign = "center"

    // Mostrar las etapas del torneo
    const stageY = 220
    const stageSpacing = 100

    // Cuartos
    ctx.fillStyle = currentStage === "cuartos" ? "#FFD700" : "#AAAAAA"
    ctx.fillText("Cuartos de Final", CANVAS_WIDTH / 2 - stageSpacing, stageY)

    // Flecha
    ctx.beginPath()
    ctx.moveTo(CANVAS_WIDTH / 2 - stageSpacing + 60, stageY + 10)
    ctx.lineTo(CANVAS_WIDTH / 2 - 60, stageY + 10)
    ctx.stroke()

    // Semifinal
    ctx.fillStyle = currentStage === "semifinal" ? "#FFD700" : "#AAAAAA"
    ctx.fillText("Semifinal", CANVAS_WIDTH / 2, stageY)

    // Flecha
    ctx.beginPath()
    ctx.moveTo(CANVAS_WIDTH / 2 + 40, stageY + 10)
    ctx.lineTo(CANVAS_WIDTH / 2 + stageSpacing - 40, stageY + 10)
    ctx.stroke()

    // Final
    ctx.fillStyle = currentStage === "final" ? "#FFD700" : "#AAAAAA"
    ctx.fillText("Final", CANVAS_WIDTH / 2 + stageSpacing, stageY)

    // Instrucciones
    ctx.fillStyle = "#90EE90"
    ctx.font = "bold 20px Arial"
    ctx.textAlign = "center"
    ctx.fillText("🎮 Presiona JUGAR para comenzar tu partido 🎮", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30)
  }

  // Modificar la función startGame para inicializar los jugadores a la altura correcta
  const startGame = () => {
    setGameState((prevState) => ({
      ...prevState,
      mode: "playing",
      player1: createPlayer(selectedPlayer1, 150, GROUND_Y - 60, true),
      player2: createPlayer(selectedPlayer2, CANVAS_WIDTH - 150, GROUND_Y - 60, false),
      ball: createBall(),
      score: { player1: 0, player2: 0 },
      timeLeft: selectedTime,
      gameTime: 0,
      durationType: durationType,
      goalLimit: selectedGoals,
    }))
  }

  const showGameOptions = () => {
    setGameState((prevState) => ({
      ...prevState,
      mode: "options",
    }))
  }

  const resetGame = () => {
    setGameState((prevState) => ({
      ...prevState,
      mode: "menu",
      score: { player1: 0, player2: 0 },
      round: 1,
      tournamentWins: 0,
    }))
  }

  const startTournamentMode = () => {
    setGameState((prev) => ({
      ...prev,
      mode: "tournamentSelect",
    }))
  }

  useEffect(() => {
    if (gameState.mode === "playing") {
      animationRef.current = requestAnimationFrame(gameLoop)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameState.mode, gameLoop])

  // Renderizar bracket si estamos en modo bracket
  useEffect(() => {
    if (gameState.mode === "bracket") {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      drawBracket(ctx)
    }
  }, [gameState.mode, gameState.tournamentBracket, gameState.tournamentStage, gameState.currentMatch])

  const render = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Aplicar screen shake
      ctx.save()
      ctx.translate(gameState.screenShake.x, gameState.screenShake.y)

      drawField(ctx)
      drawPlayer(ctx, gameState.player1)
      drawPlayer(ctx, gameState.player2)
      drawBall(ctx, gameState.ball)
      drawUI(ctx)

      // Dibujar clones de la pelota
      if (gameState.ball.clones) {
        gameState.ball.clones.forEach((clone) => {
          drawBall(ctx, clone)
        })
      }

      drawCelebration(ctx)

      ctx.restore()
    },
    [gameState],
  )

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-black p-4 relative overflow-hidden">
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
      `}</style>
      {/* Efectos de luces del estadio más intensos */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-8 left-0 w-32 h-32 bg-yellow-300 rounded-full opacity-40 animate-pulse"></div>
        <div className="absolute top-8 right-0 w-32 h-32 bg-yellow-300 rounded-full opacity-40 animate-pulse"></div>
        <div className="absolute top-16 left-1/4 w-24 h-24 bg-white rounded-full opacity-30 animate-pulse"></div>
        <div className="absolute top-16 right-1/4 w-24 h-24 bg-white rounded-full opacity-30 animate-pulse"></div>

        {/* Más vuvuzelas */}
        <div className="absolute top-24 left-12 text-5xl animate-bounce">🎺</div>
        <div className="absolute top-24 right-12 text-5xl animate-bounce">🎺</div>
        <div className="absolute top-32 left-32 text-4xl animate-bounce">🎺</div>
        <div className="absolute top-32 right-32 text-4xl animate-bounce">🎺</div>

        {/* Banderas */}
        <div className="absolute top-20 left-1/3 text-3xl animate-pulse">🏁</div>
        <div className="absolute top-20 right-1/3 text-3xl animate-pulse">🏁</div>
      </div>

      <h1 className="text-6xl font-bold text-yellow-400 mb-6 text-center drop-shadow-lg animate-pulse">
        ⚽ CabezaDura ⚽
      </h1>

      {gameState.mode === "menu" && (
        <div className="space-y-6 animate-fadeIn">
          <Card className="p-6 bg-gradient-to-b from-gray-900/90 to-black/90 backdrop-blur border-2 border-yellow-400 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-center text-yellow-400">🌟 Seleccionar Jugadores 🌟</h2>

            <div className="grid grid-cols-2 gap-6">
              {/* Jugador 1 Slider */}
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-4 text-white">Jugador 1</h3>

                <div className="relative w-full flex flex-col items-center">
                  {/* Imagen grande del personaje seleccionado */}
                  <div className="w-32 h-32 mb-4 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300 p-1 shadow-lg">
                    <div className="w-full h-full rounded-full overflow-hidden bg-gray-800 flex items-center justify-center">
                      {selectedPlayer1.headImage ? (
                        <img
                          src={selectedPlayer1.headImage || "/placeholder.svg"}
                          alt={selectedPlayer1.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-400"></div>
                      )}
                    </div>
                  </div>

                  <h4 className="text-xl font-bold text-yellow-400 mb-4">{selectedPlayer1.name}</h4>

                  {/* Controles del slider */}
                  <div className="flex items-center justify-between w-full">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full border-2 border-yellow-400 bg-black/50 text-yellow-400 hover:bg-yellow-400 hover:text-black"
                      onClick={() => {
                        const currentIndex = CHARACTERS.findIndex((c) => c.id === selectedPlayer1.id)
                        const prevIndex = (currentIndex - 1 + CHARACTERS.length) % CHARACTERS.length
                        setSelectedPlayer1(CHARACTERS[prevIndex])
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-chevron-left"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </Button>

                    <div className="flex space-x-1">
                      {CHARACTERS.map((char, index) => (
                        <div
                          key={char.id}
                          className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
                            selectedPlayer1.id === char.id ? "bg-yellow-400 w-4" : "bg-gray-500 hover:bg-gray-400"
                          }`}
                          onClick={() => setSelectedPlayer1(char)}
                        />
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full border-2 border-yellow-400 bg-black/50 text-yellow-400 hover:bg-yellow-400 hover:text-black"
                      onClick={() => {
                        const currentIndex = CHARACTERS.findIndex((c) => c.id === selectedPlayer1.id)
                        const nextIndex = (currentIndex + 1) % CHARACTERS.length
                        setSelectedPlayer1(CHARACTERS[nextIndex])
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-chevron-right"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Jugador 2 Slider */}
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-semibold mb-4 text-white">Jugador 2</h3>

                <div className="relative w-full flex flex-col items-center">
                  {/* Imagen grande del personaje seleccionado */}
                  <div className="w-32 h-32 mb-4 rounded-full bg-gradient-to-r from-blue-500 to-blue-300 p-1 shadow-lg">
                    <div className="w-full h-full rounded-full overflow-hidden bg-gray-800 flex items-center justify-center">
                      {selectedPlayer2.headImage ? (
                        <img
                          src={selectedPlayer2.headImage || "/placeholder.svg"}
                          alt={selectedPlayer2.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-400"></div>
                      )}
                    </div>
                  </div>

                  <h4 className="text-xl font-bold text-blue-400 mb-4">{selectedPlayer2.name}</h4>

                  {/* Controles del slider */}
                  <div className="flex items-center justify-between w-full">
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full border-2 border-blue-400 bg-black/50 text-blue-400 hover:bg-blue-400 hover:text-black"
                      onClick={() => {
                        const currentIndex = CHARACTERS.findIndex((c) => c.id === selectedPlayer2.id)
                        const prevIndex = (currentIndex - 1 + CHARACTERS.length) % CHARACTERS.length
                        setSelectedPlayer2(CHARACTERS[prevIndex])
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-chevron-left"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </Button>

                    <div className="flex space-x-1">
                      {CHARACTERS.map((char, index) => (
                        <div
                          key={char.id}
                          className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
                            selectedPlayer2.id === char.id ? "bg-blue-400 w-4" : "bg-gray-500 hover:bg-gray-400"
                          }`}
                          onClick={() => setSelectedPlayer2(char)}
                        />
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full border-2 border-blue-400 bg-black/50 text-blue-400 hover:bg-blue-400 hover:text-black"
                      onClick={() => {
                        const currentIndex = CHARACTERS.findIndex((c) => c.id === selectedPlayer2.id)
                        const nextIndex = (currentIndex + 1) % CHARACTERS.length
                        setSelectedPlayer2(CHARACTERS[nextIndex])
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-chevron-right"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-b from-gray-900/90 to-black/90 backdrop-blur border-2 border-green-400 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-center text-green-400">🎮 Modo de Juego 🎮</h2>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button
                variant={gameMode === "quick" ? "default" : "outline"}
                onClick={() => setGameMode("quick")}
                className={`flex items-center gap-2 border-2 transition-all duration-300 transform ${
                  gameMode === "quick"
                    ? "bg-gradient-to-r from-green-400 to-blue-500 text-white border-green-400 shadow-lg scale-105 animate-pulse"
                    : "bg-gray-800/80 hover:bg-gray-700/80 text-white border-gray-600 hover:border-green-400"
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
                Partido Rápido
              </Button>
              <Button
                variant={gameMode === "multiplayer" ? "default" : "outline"}
                onClick={() => setGameMode("multiplayer")}
                className={`flex items-center gap-2 border-2 transition-all duration-300 transform ${
                  gameMode === "multiplayer"
                    ? "bg-gradient-to-r from-purple-400 to-pink-500 text-white border-purple-400 shadow-lg scale-105 animate-pulse"
                    : "bg-gray-800/80 hover:bg-gray-700/80 text-white border-gray-600 hover:border-purple-400"
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
                Multijugador Local
              </Button>
              <Button
                variant={gameMode === "worldCup" ? "default" : "outline"}
                onClick={() => setGameMode("worldCup")}
                className={`flex items-center gap-2 border-2 transition-all duration-300 transform ${
                  gameMode === "worldCup"
                    ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-yellow-400 shadow-lg scale-105 animate-pulse"
                    : "bg-gray-800/80 hover:bg-gray-700/80 text-white border-gray-600 hover:border-yellow-400"
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 2L3 7v11a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V7l-7-5z"
                    clipRule="evenodd"
                  />
                </svg>
                Copa Mundial
              </Button>
            </div>
          </Card>

          <div className="flex gap-4 justify-center">
            <Button
              onClick={gameMode === "worldCup" ? startTournamentMode : showGameOptions}
              size="lg"
              className="text-2xl px-12 py-6 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold shadow-2xl border-4 border-white"
            >
              <svg className="w-8 h-8 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              {gameMode === "worldCup" ? "¡COMENZAR COPA MUNDIAL!" : "¡CONTINUAR!"}
            </Button>
          </div>

          <div className="flex gap-4 justify-center mt-4">
            <Button
              onClick={() => (window.location.href = "/crear-personaje")}
              size="lg"
              className="text-xl px-8 py-4 bg-gradient-to-r from-purple-400 to-pink-500 hover:from-purple-500 hover:to-pink-600 text-white font-bold shadow-xl border-2 border-white"
            >
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Crear personaje
            </Button>
          </div>

          <Card className="p-4 bg-gradient-to-b from-gray-900/90 to-black/90 backdrop-blur max-w-md border-2 border-blue-400">
            <h3 className="font-bold mb-2 text-blue-400">🎮 Controles:</h3>
            <div className="text-sm space-y-1 text-white">
              <div>
                <strong>Jugador 1:</strong> WASD + Espacio (patear)
              </div>
              <div>
                <strong>Jugador 2:</strong> Flechas + ↓ (patear)
              </div>
            </div>
          </Card>
        </div>
      )}

      {gameState.mode === "options" && (
        <div className="w-full max-w-3xl animate-fadeIn">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-blue-500/20 blur-xl rounded-full"></div>
            <h2 className="relative text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500 mb-2">
              ⚙️ Opciones de Juego ⚙️
            </h2>
            <p className="text-center text-gray-300 text-sm">Personaliza tu experiencia de juego</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Game Mode Selection */}
            <div className="bg-gradient-to-b from-gray-800/90 to-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 p-4 border-b border-gray-700">
                <h3 className="text-xl font-semibold text-white flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    />
                  </svg>
                  Modo de Juego
                </h3>
              </div>

              <div className="p-5">
                <Tabs
                  defaultValue="time"
                  className="w-full"
                  onValueChange={(value) => setDurationType(value as "time" | "goals")}
                >
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-800/50 p-1 rounded-lg">
                    <TabsTrigger
                      value="time"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white rounded-md transition-all duration-200 py-3"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>Por Tiempo</span>
                      </div>
                    </TabsTrigger>
                    <TabsTrigger
                      value="goals"
                      className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-md transition-all duration-200 py-3"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5"
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
                        <span>Por Goles</span>
                      </div>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="time" className="space-y-4 mt-2">
                    <div className="text-white text-sm mb-4">Selecciona cuánto tiempo durará el partido:</div>
                    <RadioGroup
                      defaultValue="60"
                      className="grid grid-cols-2 gap-3"
                      onValueChange={(value) => setSelectedTime(Number.parseInt(value))}
                    >
                      {TIME_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className={`
                    relative flex items-center justify-center p-4 rounded-lg cursor-pointer
                    transition-all duration-200 overflow-hidden
                    ${
                      selectedTime === option.value
                        ? "bg-gradient-to-br from-green-500/30 to-green-700/30 border-2 border-green-500 shadow-lg shadow-green-500/20"
                        : "bg-gray-800/40 border border-gray-700 hover:border-green-500/50"
                    }
                  `}
                        >
                          <input
                            type="radio"
                            value={option.value.toString()}
                            name="time-option"
                            className="sr-only"
                            checked={selectedTime === option.value}
                            onChange={() => setSelectedTime(option.value)}
                          />
                          <div className="text-center">
                            <div className="text-lg font-medium text-white">{option.label}</div>
                            {selectedTime === option.value && (
                              <div className="absolute top-1 right-1">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4 text-green-400"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </TabsContent>

                  <TabsContent value="goals" className="space-y-4 mt-2">
                    <div className="text-white text-sm mb-4">Selecciona el número de goles para ganar:</div>
                    <RadioGroup
                      defaultValue="5"
                      className="grid grid-cols-2 gap-3"
                      onValueChange={(value) => setSelectedGoals(Number.parseInt(value))}
                    >
                      {GOAL_OPTIONS.map((option) => (
                        <label
                          key={option.value}
                          className={`
                    relative flex items-center justify-center p-4 rounded-lg cursor-pointer
                    transition-all duration-200 overflow-hidden
                    ${
                      selectedGoals === option.value
                        ? "bg-gradient-to-br from-blue-500/30 to-blue-700/30 border-2 border-blue-500 shadow-lg shadow-blue-500/20"
                        : "bg-gray-800/40 border border-gray-700 hover:border-blue-500/50"
                    }
                  `}
                        >
                          <input
                            type="radio"
                            value={option.value.toString()}
                            name="goal-option"
                            className="sr-only"
                            checked={selectedGoals === option.value}
                            onChange={() => setSelectedGoals(option.value)}
                          />
                          <div className="text-center">
                            <div className="text-lg font-medium text-white">{option.label}</div>
                            {selectedGoals === option.value && (
                              <div className="absolute top-1 right-1">
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4 text-blue-400"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* Game Info and Controls */}
            <div className="flex flex-col space-y-6">
              {/* Game Preview */}
              <div className="bg-gradient-to-b from-gray-800/90 to-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-4 border-b border-gray-700">
                  <h3 className="text-xl font-semibold text-white flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2 text-yellow-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Vista Previa
                  </h3>
                </div>

                <div className="p-5">
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 flex items-center justify-center text-xs font-bold">
                          {selectedPlayer1.name.charAt(0)}
                        </div>
                        <span className="ml-2 text-white">{selectedPlayer1.name}</span>
                      </div>
                      <div className="text-xl font-bold text-white">VS</div>
                      <div className="flex items-center">
                        <span className="mr-2 text-white">{selectedPlayer2.name}</span>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center text-xs font-bold">
                          {selectedPlayer2.name.charAt(0)}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center items-center space-x-3 py-2">
                      <div className="text-center">
                        <div className="text-sm text-gray-400">Modo</div>
                        <div className="text-white font-medium">
                          {durationType === "time" ? "Por Tiempo" : "Por Goles"}
                        </div>
                      </div>
                      <div className="h-10 border-l border-gray-700"></div>
                      <div className="text-center">
                        <div className="text-sm text-gray-400">Duración</div>
                        <div className="text-white font-medium">
                          {durationType === "time"
                            ? `${Math.floor(selectedTime / 60)}:${(selectedTime % 60).toString().padStart(2, "0")}`
                            : `${selectedGoals} goles`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls Info */}
              <div className="bg-gradient-to-b from-gray-800/90 to-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-4 border-b border-gray-700">
                  <h3 className="text-xl font-semibold text-white flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-2 text-purple-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                      />
                    </svg>
                    Controles
                  </h3>
                </div>

                <div className="p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                      <div className="text-yellow-400 font-medium mb-1">Jugador 1</div>
                      <div className="text-sm text-white">
                        <div className="flex items-center mb-1">
                          <div className="bg-gray-800 rounded px-2 py-1 text-xs mr-2 w-16 text-center">W A S D</div>
                          <span>Movimiento</span>
                        </div>
                        <div className="flex items-center">
                          <div className="bg-gray-800 rounded px-2 py-1 text-xs mr-2 w-16 text-center">ESPACIO</div>
                          <span>Patear</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
                      <div className="text-blue-400 font-medium mb-1">Jugador 2</div>
                      <div className="text-sm text-white">
                        <div className="flex items-center mb-1">
                          <div className="bg-gray-800 rounded px-2 py-1 text-xs mr-2 w-16 text-center">↑ ← ↓ →</div>
                          <span>Movimiento</span>
                        </div>
                        <div className="flex items-center">
                          <div className="bg-gray-800 rounded px-2 py-1 text-xs mr-2 w-16 text-center">↓</div>
                          <span>Patear</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center mt-8 space-x-4">
            <Button
              onClick={startGame}
              size="lg"
              className="relative overflow-hidden group bg-gradient-to-br from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-bold px-10 py-6 rounded-xl shadow-lg transition-all duration-200 border-2 border-transparent hover:border-white/20"
            >
              <div className="absolute inset-0 w-full h-full bg-white/10 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
              <div className="relative flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-xl">¡Comenzar Partido!</span>
              </div>
            </Button>

            <Button
              onClick={() => setGameState((prev) => ({ ...prev, mode: "menu" }))}
              variant="outline"
              size="lg"
              className="bg-transparent border-2 border-white/30 hover:border-white text-white hover:bg-white/10 px-6 py-6 rounded-xl transition-all duration-200"
            >
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                </svg>
                <span>Volver</span>
              </div>
            </Button>
          </div>
        </div>
      )}

      {gameState.mode === "tournamentSelect" && (
        <Card className="p-6 bg-gradient-to-b from-gray-900/90 to-black/90 backdrop-blur border-2 border-yellow-400 shadow-2xl animate-fadeIn">
          <h2 className="text-2xl font-bold mb-4 text-center text-yellow-400">
            🏆 Selecciona tu Jugador para la Copa Mundial 🏆
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {CHARACTERS.map((char) => (
              <Button
                key={char.id}
                variant={tournamentPlayer.id === char.id ? "default" : "outline"}
                className={`p-3 h-auto flex flex-col items-center justify-center transition-all duration-200 ${
                  tournamentPlayer.id === char.id
                    ? "bg-yellow-500 hover:bg-yellow-600 text-black border-2 border-yellow-400 shadow-lg scale-105"
                    : "bg-gray-800/80 hover:bg-gray-700/80 text-white border-2 border-gray-600"
                }`}
                onClick={() => setTournamentPlayer(char)}
              >
                {char.headImage ? (
                  <img
                    src={char.headImage || "/placeholder.svg"}
                    alt={char.name}
                    className="w-10 h-10 mx-auto mb-1 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 mx-auto mb-1 rounded-full bg-gray-400"></div>
                )}
                <div className="font-bold text-xs whitespace-nowrap">{char.name}</div>
              </Button>
            ))}
          </div>
          <div className="flex gap-4 justify-center mt-6">
            <Button
              onClick={initTournament}
              size="lg"
              className="text-xl px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold"
            >
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 2L3 7v11a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V7l-7-5z"
                  clipRule="evenodd"
                />
              </svg>
              ¡Comenzar Copa Mundial!
            </Button>
            <Button
              onClick={() => setGameState((prev) => ({ ...prev, mode: "menu" }))}
              variant="outline"
              size="lg"
              className="border-2 border-white text-white"
            >
              Volver
            </Button>
          </div>
        </Card>
      )}

      {gameState.mode === "bracket" && (
        <div className="space-y-4 animate-fadeIn">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border-4 border-yellow-400 rounded-lg shadow-2xl"
          />
          <div className="flex gap-4 justify-center">
            <Button
              onClick={startTournamentMatch}
              size="lg"
              className="text-xl px-8 py-4 bg-gradient-to-r from-green-400 to-blue-500 hover:from-green-500 hover:to-blue-600 text-white font-bold"
            >
              <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                  clipRule="evenodd"
                />
              </svg>
              ¡Jugar Partido!
            </Button>
            <Button
              onClick={() => setGameState((prev) => ({ ...prev, mode: "menu" }))}
              variant="outline"
              size="lg"
              className="border-2 border-white text-white"
            >
              Abandonar Torneo
            </Button>
          </div>
        </div>
      )}

      {(gameState.mode === "playing" || gameState.mode === "paused") && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => setGameState((prev) => ({ ...prev, mode: prev.mode === "paused" ? "playing" : "paused" }))}
              variant="outline"
              className="bg-black/80 text-white border-white"
            >
              {gameState.mode === "paused" ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </Button>
            <Button onClick={resetGame} variant="outline" className="bg-black/80 text-white border-white">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clipRule="evenodd"
                />
              </svg>
            </Button>
          </div>

          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border-4 border-yellow-400 rounded-lg shadow-2xl"
          />

          {gameState.mode === "paused" && (
            <Card className="p-4 bg-black/90 backdrop-blur text-center border-2 border-yellow-400">
              <h2 className="text-xl font-bold text-yellow-400">⏸️ Juego Pausado</h2>
              <p className="text-white">Presiona play para continuar</p>
            </Card>
          )}
        </div>
      )}

      {gameState.mode === "gameOver" && (
        <Card className="p-8 bg-black/90 backdrop-blur text-center border-4 border-yellow-400 shadow-2xl animate-fadeIn">
          {gameMode === "worldCup" ? (
            <div>
              {gameState.score.player1 > gameState.score.player2 ? (
                <div>
                  {gameState.tournamentStage === "final" &&
                  gameState.tournamentBracket.champion === tournamentPlayer.id ? (
                    <div>
                      <div className="text-5xl mb-6 text-yellow-400 animate-bounce">🏆 ¡CAMPEÓN! 🏆</div>
                      <div className="text-3xl mb-4 text-green-400">
                        🏆 {tournamentPlayer.name} conquistó el Torneo 🏆
                      </div>
                      <div className="text-xl mb-4 text-blue-400">¡Gloria eterna!</div>
                      <div className="flex justify-center space-x-4 mb-4">
                        <div className="text-6xl animate-pulse">🥇</div>
                        <div className="text-6xl animate-pulse">🎉</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl mb-4 text-green-400">🥇 ¡{tournamentPlayer.name} AVANZA! 🥇</div>
                      <div className="text-xl mb-4 text-blue-400">
                        Clasificaste a{" "}
                        {TOURNAMENT_STAGES[gameState.tournamentStage].nextStage === "semifinal"
                          ? "Semifinales"
                          : TOURNAMENT_STAGES[gameState.tournamentStage].nextStage === "final"
                            ? "la Final"
                            : "la siguiente fase"}
                      </div>
                      <div className="text-lg mb-4 text-white">
                        {gameState.tournamentStage === "cuartos" && "¡Excelente! Ahora vas por las semifinales."}
                        {gameState.tournamentStage === "semifinal" && "¡Increíble! Estás en la Final del Torneo."}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-4 text-red-400">
                    😢 Eliminado en {TOURNAMENT_STAGES[gameState.tournamentStage].name}
                  </div>
                  <div className="text-xl mb-4 text-gray-400">¡Mejor suerte la próxima vez!</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-3xl mb-4 text-white">
              {gameState.score.player1 > gameState.score.player2
                ? `🥇 ¡${selectedPlayer1.name} GANA! 🥇`
                : gameState.score.player2 > gameState.score.player1
                  ? `🥇 ¡${selectedPlayer2.name} GANA! 🥇`
                  : "🤝 ¡EMPATE ÉPICO! 🤝"}
            </div>
          )}

          <div className="text-2xl mb-6 text-blue-400">
            Marcador Final: {gameState.score.player1} - {gameState.score.player2}
          </div>

          <div className="flex gap-4 justify-center">
            {gameMode === "worldCup" ? (
              // En modo torneo
              gameState.score.player1 > gameState.score.player2 && gameState.tournamentStage !== "final" ? (
                // Si ganó y no es la final, mostrar botón para continuar
                <Button
                  onClick={() => setGameState((prev) => ({ ...prev, mode: "bracket" }))}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-4"
                >
                  🏆 {gameState.tournamentStage === "cuartos" ? "Ir a Semifinales" : "Ir a la Final"}
                </Button>
              ) : (
                // Si perdió o es campeón, solo mostrar botón de menú principal
                <Button
                  onClick={resetGame}
                  size="lg"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold px-8 py-3"
                >
                  🏠 Volver al Menú Principal
                </Button>
              )
            ) : (
              // En modo partido rápido o multijugador, mostrar ambos botones
              <>
                <Button onClick={startGame} size="lg" className="bg-green-600 hover:bg-green-700">
                  🔄 Revancha
                </Button>
                <Button onClick={resetGame} variant="outline" size="lg" className="border-2 border-white text-white">
                  🏠 Menú Principal
                </Button>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
