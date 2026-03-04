import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { mockApi } from './services/mockApi'
import { trackEvent } from './utils/analytics'

const copy = {
  en: {
    title: 'Pension Mini App',
    subtitle: 'Competition-ready frontend prototype for KBZ mini app',
    withdraw: 'Withdraw Pension',
    representative: "Pensioner's Representative",
    identity: 'Identity & OTP',
    biometric: 'Biometric Verify',
    review: 'Review & Confirm',
    success: 'Success',
    getOtp: 'Get OTP',
    continue: 'Continue',
    verifyFace: 'Verify Face',
    confirm: 'Confirm Withdrawal',
    saveReceipt: 'Save E-receipt',
    done: 'Done',
    back: 'Back',
    addPensioner: 'Add Pensioner',
    submitRequest: 'Submit Request',
    withdrawAsRep: 'Acting as representative for',
    waitApproval: 'Wait for approval',
  },
  my: {
    title: 'ပင်စင် Mini App',
    subtitle: 'KBZ mini app ပြိုင်ပွဲအတွက် frontend prototype',
    withdraw: 'ပင်စင်ထုတ်ယူရန်',
    representative: 'ကိုယ်စားလှယ်',
    identity: 'အချက်အလက် & OTP',
    biometric: 'မျက်နှာအတည်ပြု',
    review: 'စစ်ဆေး & အတည်ပြု',
    success: 'အောင်မြင်သည်',
    getOtp: 'OTP ရယူရန်',
    continue: 'ဆက်သွားရန်',
    verifyFace: 'မျက်နှာအတည်ပြုရန်',
    confirm: 'ထုတ်ယူမှုအတည်ပြုရန်',
    saveReceipt: 'E-receipt သိမ်းရန်',
    done: 'ပြီးပြီ',
    back: 'နောက်သို့',
    addPensioner: 'ပင်စင်ရယူသူ ထည့်ရန်',
    submitRequest: 'လျှောက်လွှာတင်ရန်',
    withdrawAsRep: 'ကိုယ်စားလှယ်အဖြစ် ဆောင်ရွက်နေသည်',
    waitApproval: 'အတည်ပြုချက်ကို စောင့်ပါ',
  },
}

const validators = {
  pensionerNo: (value) => /^\d{12}$/.test(value.trim()),
  pensionCardNo: (value) => /^PC-\d{6}$/.test(value.trim().toUpperCase()),
  otp: (value) => /^\d{6}$/.test(value.trim()),
  pin: (value) => /^\d{6}$/.test(value.trim()),
  nrc: (value) => /^\d{1,2}\/[A-Z]{3,12}\(N\)\d{6}$/i.test(value.trim()),
}

const statusOrder = { PENDING: 0, 'UNDER REVIEW': 1, APPROVED: 2 }

const hideSensitive = (value, visible = 4) => {
  if (!value) return '-'
  const raw = String(value)
  if (raw.length <= visible) return raw
  return `${'*'.repeat(raw.length - visible)}${raw.slice(-visible)}`
}

function App() {
  const [lang, setLang] = useState('en')
  const t = copy[lang]

  const [activeSection, setActiveSection] = useState('withdraw')
  const [withdrawStep, setWithdrawStep] = useState('identity')
  const [withdrawType, setWithdrawType] = useState('self')

  const [identityForm, setIdentityForm] = useState({
    pensionerNo: '',
    pensionCardNo: '',
    otpInput: '',
    pin: '',
  })

  const [otpMeta, setOtpMeta] = useState({
    otpToken: '',
    otpCode: '',
    expiresAt: 0,
    requestCount: 0,
    verifyFailures: 0,
  })

  const [pinFailures, setPinFailures] = useState(0)
  const [lockUntil, setLockUntil] = useState(0)
  const [tickNow, setTickNow] = useState(Date.now())

  const [otpCode, setOtpCode] = useState('')
  const [loadingKey, setLoadingKey] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const [receiptData, setReceiptData] = useState(null)

  const [biometricState, setBiometricState] = useState({
    cameraPermission: 'idle',
    faceDetected: false,
    faceConfidence: 0,
    blinkCheck: false,
    leftTurnCheck: false,
    rightTurnCheck: false,
    qualityScore: 0,
    attempts: 0,
    currentPrompt: '',
    scanning: false,
    scanCountdown: 0,
  })
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const faceDetectorRef = useRef(null)
  const detectionLoopRef = useRef(null)
  const [reviewChecks, setReviewChecks] = useState({ identity: false, fee: false })
  const [maskData, setMaskData] = useState(true)
  const [copiedRef, setCopiedRef] = useState(false)
  const [sharedSummary, setSharedSummary] = useState(false)

  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)

  const [newMemberForm, setNewMemberForm] = useState({
    pensionerNo: '',
    pensionCardNo: '',
    name: '',
    nrcNo: '',
    relationship: '',
    pin: '',
  })

  const [alert, setAlert] = useState({ type: 'info', message: '' })

  const currentProfile = useMemo(() => {
    if (withdrawType === 'representative' && selectedMember) {
      return selectedMember
    }

    return {
      pensionerNo: identityForm.pensionerNo,
      pensionCardNo: identityForm.pensionCardNo || 'PC-100000',
      name: 'U Thura Win',
      nrcNo: '12/THAKANA(N)991100',
    }
  }, [withdrawType, selectedMember, identityForm.pensionerNo, identityForm.pensionCardNo])

  const isLocked = lockUntil > Date.now()
  const lockSeconds = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000))
  const otpSeconds = Math.max(0, Math.ceil((otpMeta.expiresAt - tickNow) / 1000))
  const biometricPassed =
    biometricState.cameraPermission === 'granted' &&
    biometricState.faceDetected &&
    biometricState.blinkCheck &&
    biometricState.leftTurnCheck &&
    biometricState.rightTurnCheck &&
    biometricState.qualityScore >= 80

  useEffect(() => {
    const timer = setInterval(() => setTickNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchMembers = async () => {
      setMembersLoading(true)
      try {
        const response = await mockApi.fetchRepresentativeMembers()
        setMembers(response)
      } catch (error) {
        setAlert({ type: 'error', message: error.message })
      } finally {
        setMembersLoading(false)
      }
    }

    fetchMembers()
  }, [])

  useEffect(() => {
    if (activeSection !== 'representative') {
      return undefined
    }

    const poller = setInterval(async () => {
      try {
        const updated = await mockApi.pollRepresentativeStatuses()
        const prevStatusMap = new Map(members.map((member) => [member.id, member.status]))
        const hasStatusChange = updated.some((member) => prevStatusMap.get(member.id) !== member.status)

        if (hasStatusChange) {
          setAlert({ type: 'info', message: 'Representative status was updated.' })
          trackEvent('rep_status_changed')
        }

        setMembers(updated)
      } catch {
        // silent poll failure
      }
    }, 8000)

    return () => clearInterval(poller)
  }, [activeSection, members])

  const withdrawSteps = [
    { key: 'identity', label: t.identity },
    { key: 'biometric', label: t.biometric },
    { key: 'review', label: t.review },
    { key: 'success', label: t.success },
  ]

  const setInfo = (message, type = 'info') => setAlert({ type, message })

  const resetWithdrawFlow = () => {
    setWithdrawStep('identity')
    setIdentityForm((prev) => ({ ...prev, otpInput: '', pin: '' }))
    setOtpMeta({ otpToken: '', otpCode: '', expiresAt: 0, requestCount: 0, verifyFailures: 0 })
    setOtpCode('')
    setFieldErrors({})
    setPinFailures(0)
    setLockUntil(0)
    setReceiptData(null)
    setBiometricState({
      cameraPermission: 'idle',
      faceDetected: false,
      faceConfidence: 0,
      blinkCheck: false,
      leftTurnCheck: false,
      rightTurnCheck: false,
      qualityScore: 0,
      attempts: 0,
      currentPrompt: '',
      scanning: false,
      scanCountdown: 0,
    })
    setReviewChecks({ identity: false, fee: false })
    setMaskData(true)
    setCopiedRef(false)
    setSharedSummary(false)
    setInfo('')
  }

  const validateIdentityForOtp = () => {
    const errors = {}
    if (!validators.pensionerNo(identityForm.pensionerNo)) {
      errors.pensionerNo = 'Pensioner No must be 12 digits.'
    }
    if (!validators.pensionCardNo(identityForm.pensionCardNo)) {
      errors.pensionCardNo = 'Pension Card No format must be PC-XXXXXX.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const requestOtp = async () => {
    if (loadingKey || isLocked) return
    if (!validateIdentityForOtp()) return

    if (otpMeta.requestCount >= 3) {
      setLockUntil(Date.now() + 60000)
      setInfo('Too many OTP requests. Please wait 60 seconds.', 'error')
      return
    }

    setLoadingKey('requestOtp')
    try {
      const response = await mockApi.requestOtp({
        pensionerNo: identityForm.pensionerNo,
        pensionCardNo: identityForm.pensionCardNo.toUpperCase(),
      })

      setOtpMeta((prev) => ({
        ...prev,
        otpToken: response.otpToken,
        otpCode: response.otpCode,
        expiresAt: Date.now() + response.expiresInSeconds * 1000,
        requestCount: prev.requestCount + 1,
      }))
      setOtpCode(response.otpCode)
      setInfo(`OTP sent. Demo OTP: ${response.otpCode}`)
      trackEvent('otp_requested')
    } catch (error) {
      setInfo(error.message, 'error')
    } finally {
      setLoadingKey('')
    }
  }

  const verifyOtpAndContinue = async () => {
    if (loadingKey || isLocked) return

    const errors = {}
    if (!otpMeta.otpToken) {
      errors.otpInput = 'Request OTP first.'
    }
    if (!validators.otp(identityForm.otpInput)) {
      errors.otpInput = 'OTP must be 6 digits.'
    }
    if (otpSeconds <= 0) {
      errors.otpInput = 'OTP expired. Please request a new OTP.'
    }

    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    if (otpMeta.verifyFailures >= 3) {
      setLockUntil(Date.now() + 60000)
      setInfo('OTP retries exceeded. Locked for 60 seconds.', 'error')
      return
    }

    setLoadingKey('verifyOtp')
    try {
      await mockApi.verifyOtp({ otpCode: otpMeta.otpCode, inputOtp: identityForm.otpInput })
      setWithdrawStep('biometric')
      setFieldErrors({})
      setBiometricState({
        cameraPermission: 'idle',
        faceDetected: false,
        faceConfidence: 0,
        blinkCheck: false,
        leftTurnCheck: false,
        rightTurnCheck: false,
        qualityScore: 0,
        attempts: 0,
        currentPrompt: '',
        scanning: false,
        scanCountdown: 0,
      })
      setInfo('OTP verified. Continue with face verification.')
      trackEvent('otp_verified')
    } catch (error) {
      setOtpMeta((prev) => ({ ...prev, verifyFailures: prev.verifyFailures + 1 }))
      setInfo(error.message, 'error')
    } finally {
      setLoadingKey('')
    }
  }

  const verifyFace = async () => {
    if (loadingKey) return

    if (!biometricPassed) {
      setInfo('Complete camera permission and all liveness checks first.', 'error')
      return
    }

    if (biometricState.attempts >= 3) {
      setLockUntil(Date.now() + 60000)
      setInfo('Biometric attempts exceeded. Locked for 60 seconds.', 'error')
      return
    }

    setLoadingKey('verifyFace')

    try {
      await mockApi.verifyFace()
      setReviewChecks({ identity: false, fee: false })
      setWithdrawStep('review')
      setInfo('Biometric verification successful.')
      trackEvent('face_verified')
    } catch (error) {
      setBiometricState((prev) => ({ ...prev, attempts: prev.attempts + 1 }))
      setInfo(error.message, 'error')
    } finally {
      setLoadingKey('')
    }
  }

  const stopCamera = useCallback(() => {
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current)
      detectionLoopRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    if (withdrawStep !== 'biometric') {
      stopCamera()
    }
  }, [withdrawStep, stopCamera])

  // Attach stream to video element whenever it mounts or stream changes
  useEffect(() => {
    if (biometricState.cameraPermission === 'granted' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [biometricState.cameraPermission])

  // ---- Face detection helpers ----
  const analyzeSkinTone = useCallback((canvas, video) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const w = 200
    const h = 200
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, w, h)

    // Analyze center oval region only (where face should be)
    const cx = w / 2
    const cy = h / 2
    const rx = w * 0.28
    const ry = h * 0.38
    const imageData = ctx.getImageData(0, 0, w, h)
    const { data } = imageData

    let skinPixels = 0
    let totalPixels = 0

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Check if pixel is inside the oval
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        if (dx * dx + dy * dy > 1) continue

        totalPixels++
        const idx = (y * w + x) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        // Skin tone detection (YCbCr-based)
        const yVal = 0.299 * r + 0.587 * g + 0.114 * b
        const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b
        const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b

        if (yVal > 60 && cb > 77 && cb < 127 && cr > 133 && cr < 173) {
          skinPixels++
        }
      }
    }

    if (totalPixels === 0) return 0
    return skinPixels / totalPixels
  }, [])

  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    // Try native FaceDetector API (Chrome 70+, Edge)
    if ('FaceDetector' in window && !faceDetectorRef.current) {
      try {
        faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 })
      } catch {
        faceDetectorRef.current = null
      }
    }

    let lastDetectionTime = 0
    const DETECTION_INTERVAL = 400 // ms between checks

    const loop = async (timestamp) => {
      if (!streamRef.current || !videoRef.current) return

      if (timestamp - lastDetectionTime >= DETECTION_INTERVAL) {
        lastDetectionTime = timestamp
        const video = videoRef.current

        if (video.readyState >= 2) {
          let detected = false
          let confidence = 0

          // Primary: FaceDetector API
          if (faceDetectorRef.current) {
            try {
              const faces = await faceDetectorRef.current.detect(video)
              if (faces.length > 0) {
                detected = true
                const box = faces[0].boundingBox
                const faceArea = box.width * box.height
                const videoArea = video.videoWidth * video.videoHeight
                confidence = Math.min(98, Math.round((faceArea / videoArea) * 500 + 40))
              }
            } catch {
              // FaceDetector failed, fall through to skin-tone
            }
          }

          // Fallback: skin-tone heuristic
          if (!detected && canvasRef.current) {
            const skinRatio = analyzeSkinTone(canvasRef.current, video)
            if (skinRatio > 0.15) {
              detected = true
              confidence = Math.min(95, Math.round(skinRatio * 250 + 30))
            }
          }

          setBiometricState((prev) => {
            if (prev.faceDetected !== detected || Math.abs(prev.faceConfidence - confidence) > 3) {
              return { ...prev, faceDetected: detected, faceConfidence: confidence }
            }
            return prev
          })
        }
      }

      detectionLoopRef.current = requestAnimationFrame(loop)
    }

    detectionLoopRef.current = requestAnimationFrame(loop)
  }, [analyzeSkinTone])

  const requestCameraPermission = async () => {
    if (loadingKey) return
    if (isLocked) {
      setInfo(`Please wait ${lockSeconds}s and retry camera permission.`, 'error')
      return
    }

    setLoadingKey('cameraPermission')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      setBiometricState((prev) => ({ ...prev, cameraPermission: 'granted' }))
      setInfo('Camera active. Detecting face...')
      trackEvent('camera_permission_granted')
      // Start real-time face detection after video element mounts
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current
          videoRef.current.play().catch(() => {})
        }
        startFaceDetection()
      }, 500)
    } catch (err) {
      setBiometricState((prev) => ({ ...prev, cameraPermission: 'denied' }))
      setInfo('Camera access denied. Please allow camera in browser settings and try again.', 'error')
      trackEvent('camera_permission_denied')
    } finally {
      setLoadingKey('')
    }
  }

  const runLivenessCheck = (checkName) => {
    if (biometricState.cameraPermission !== 'granted') {
      setInfo('Enable camera first.', 'error')
      return
    }
    if (!biometricState.faceDetected) {
      setInfo('No human face detected. Position your face in the oval frame.', 'error')
      return
    }
    if (biometricState.scanning) return

    const prompts = {
      blinkCheck: 'Please blink slowly now...',
      leftTurnCheck: 'Turn your head to the left slowly...',
      rightTurnCheck: 'Turn your head to the right slowly...',
    }

    setBiometricState((prev) => ({
      ...prev,
      currentPrompt: prompts[checkName] || '',
      scanning: true,
      scanCountdown: 3,
    }))

    let count = 3
    const timer = setInterval(() => {
      count -= 1
      if (count <= 0) {
        clearInterval(timer)
        setBiometricState((prev) => {
          const next = { ...prev, [checkName]: true, scanning: false, currentPrompt: '', scanCountdown: 0 }
          const completed = [next.blinkCheck, next.leftTurnCheck, next.rightTurnCheck].filter(Boolean).length
          next.qualityScore = Math.min(99, 55 + completed * 15)
          return next
        })
      } else {
        setBiometricState((prev) => ({ ...prev, scanCountdown: count }))
      }
    }, 1000)
  }

  const confirmWithdrawal = async () => {
    if (loadingKey) return
    if (isLocked) {
      setInfo(`Please wait ${lockSeconds}s before confirming.`, 'error')
      return
    }

    if (!reviewChecks.identity || !reviewChecks.fee) {
      setFieldErrors((prev) => ({
        ...prev,
        reviewConsent: 'Please confirm identity and fee acknowledgement to continue.',
      }))
      return
    }

    if (!validators.pin(identityForm.pin)) {
      setFieldErrors((prev) => ({ ...prev, pin: 'PIN must be 6 digits.' }))
      return
    }

    if (pinFailures >= 3) {
      setLockUntil(Date.now() + 60000)
      setInfo('PIN retries exceeded. Locked for 60 seconds.', 'error')
      return
    }

    setLoadingKey('confirmWithdrawal')
    try {
      const response = await mockApi.submitWithdrawal({ profile: currentProfile })
      setReceiptData(response)
      setWithdrawStep('success')
      setInfo('Pension withdrawn successfully.', 'success')
      setIdentityForm((prev) => ({ ...prev, otpInput: '', pin: '' }))
      setOtpMeta({ otpToken: '', otpCode: '', expiresAt: 0, requestCount: 0, verifyFailures: 0 })
      setFieldErrors({})
      trackEvent('withdrawal_success', { amount: response.totalPayment })
    } catch (error) {
      setPinFailures((prev) => prev + 1)
      setInfo(error.message, 'error')
    } finally {
      setLoadingKey('')
    }
  }

  const handleSaveReceipt = () => {
    if (!receiptData) return

    const receipt = [
      'Pension Mini App - E-Receipt',
      `Order No: ${receiptData.orderNo}`,
      `Pension Card No: ${receiptData.profile.pensionCardNo}`,
      `Pensioner Name: ${receiptData.profile.name}`,
      `NRC No: ${receiptData.profile.nrcNo}`,
      `Pension Amount: ${receiptData.pensionAmount.toLocaleString()} MMK`,
      `Allowance: ${receiptData.allowanceAmount.toLocaleString()} MMK`,
      `Transaction Fee (1%): ${receiptData.fee.toLocaleString()} MMK`,
      `Total Payment: ${receiptData.totalPayment.toLocaleString()} MMK`,
      `Date: ${new Date(receiptData.timestamp).toLocaleString()}`,
    ].join('\n')

    const blob = new Blob([receipt], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pension-receipt-${receiptData.orderNo}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    trackEvent('receipt_downloaded')
  }

  const copyTransactionRef = async () => {
    if (!receiptData) return
    const ref = `${receiptData.orderNo}-${receiptData.profile.pensionCardNo.slice(-3)}`

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ref)
      } else {
        const input = document.createElement('textarea')
        input.value = ref
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
      }
      setCopiedRef(true)
      setInfo('Transaction reference copied.')
      trackEvent('transaction_ref_copied')
    } catch {
      setInfo('Clipboard access is not available in this environment.', 'error')
    }
  }

  const shareSummary = async () => {
    if (!receiptData) return

    const summary = `Pension Withdrawn\nOrder: ${receiptData.orderNo}\nAmount: ${receiptData.totalPayment.toLocaleString()} MMK`

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Pension Receipt', text: summary })
      } else {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(summary)
        } else {
          const input = document.createElement('textarea')
          input.value = summary
          document.body.appendChild(input)
          input.select()
          document.execCommand('copy')
          document.body.removeChild(input)
        }
        setInfo('Share API not available. Summary copied to clipboard instead.', 'success')
      }
      setSharedSummary(true)
      if (navigator.share) {
        setInfo('Summary shared successfully.')
      }
      trackEvent('receipt_summary_shared')
    } catch {
      setInfo('Unable to share summary right now.', 'error')
    }
  }

  const handleAddPensioner = async (event) => {
    event.preventDefault()

    const errors = {}
    if (!validators.pensionerNo(newMemberForm.pensionerNo)) {
      errors.newPensionerNo = 'Pensioner No must be 12 digits.'
    }
    if (!validators.pensionCardNo(newMemberForm.pensionCardNo)) {
      errors.newPensionCardNo = 'Pension Card No must be PC-XXXXXX.'
    }
    if (!newMemberForm.name.trim()) {
      errors.newName = 'Name is required.'
    }
    if (!validators.nrc(newMemberForm.nrcNo)) {
      errors.newNrc = 'NRC format is invalid.'
    }
    if (!newMemberForm.relationship.trim()) {
      errors.newRelationship = 'Relationship is required.'
    }
    if (!validators.pin(newMemberForm.pin)) {
      errors.newPin = 'PIN must be 6 digits.'
    }

    setFieldErrors((prev) => ({ ...prev, ...errors }))
    if (Object.keys(errors).length > 0 || loadingKey) {
      return
    }

    setLoadingKey('submitRep')
    try {
      const response = await mockApi.submitRepresentativeRequest({
        ...newMemberForm,
        pensionCardNo: newMemberForm.pensionCardNo.toUpperCase(),
      })

      setMembers((prev) => [response, ...prev])
      setNewMemberForm({
        pensionerNo: '',
        pensionCardNo: '',
        name: '',
        nrcNo: '',
        relationship: '',
        pin: '',
      })
      setInfo('Representative request submitted. Status: PENDING', 'success')
      trackEvent('rep_request_submitted')
    } catch (error) {
      setInfo(error.message, 'error')
    } finally {
      setLoadingKey('')
    }
  }

  const startRepresentativeWithdraw = (member) => {
    setSelectedMember(member)
    setWithdrawType('representative')
    setIdentityForm({ pensionerNo: member.pensionerNo, pensionCardNo: member.pensionCardNo, otpInput: '', pin: '' })
    setActiveSection('withdraw')
    resetWithdrawFlow()
    setIdentityForm({ pensionerNo: member.pensionerNo, pensionCardNo: member.pensionCardNo, otpInput: '', pin: '' })
    setInfo('Representative identity pre-filled. Continue with OTP.')
    trackEvent('rep_withdraw_started')
  }

  const backToDashboard = () => {
    setWithdrawType('self')
    setSelectedMember(null)
    setIdentityForm({ pensionerNo: '', pensionCardNo: '', otpInput: '', pin: '' })
    resetWithdrawFlow()
  }

  const stepIndex = (key) => withdrawSteps.findIndex((s) => s.key === key)
  const currentStepIdx = stepIndex(withdrawStep)

  const canNavigateToStep = (targetKey) => {
    const targetIdx = stepIndex(targetKey)
    if (targetIdx >= currentStepIdx) return false
    if (targetKey === 'success') return false
    return true
  }

  const navigateToStep = (targetKey) => {
    if (!canNavigateToStep(targetKey) || isAnyLoading) return
    setWithdrawStep(targetKey)
    setFieldErrors({})
    setInfo('')
  }

  const goBackStep = () => {
    if (withdrawStep === 'review') {
      setWithdrawStep('biometric')
      return
    }
    if (withdrawStep === 'biometric') {
      setWithdrawStep('identity')
    }
  }

  const sortedMembers = [...members].sort((left, right) =>
    statusOrder[right.status] - statusOrder[left.status],
  )

  const renderError = (key) =>
    fieldErrors[key] ? <small className="inline-error">{fieldErrors[key]}</small> : null

  const isBusy = (key) => loadingKey === key
  const isAnyLoading = Boolean(loadingKey)

  const statusClass = (status) => {
    if (status === 'APPROVED') return 'status-ok'
    if (status === 'UNDER REVIEW') return 'status-review'
    return 'status-pending'
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-top">
          <p className="eyebrow">KBZPay • Mini App</p>
          <div className="header-actions">
            <div className="lang-switch">
              <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>
                EN
              </button>
              <button type="button" className={lang === 'my' ? 'active' : ''} onClick={() => setLang('my')}>
                MM
              </button>
            </div>
          </div>
        </div>
        <h1>{t.title}</h1>
      </header>

      <nav className="top-nav">
        <button
          className={activeSection === 'withdraw' ? 'active' : ''}
          onClick={() => setActiveSection('withdraw')}
        >
          {t.withdraw}
        </button>
        <button
          className={activeSection === 'representative' ? 'active' : ''}
          onClick={() => setActiveSection('representative')}
        >
          {t.representative}
        </button>
      </nav>

      {alert.message && <div className={`alert ${alert.type}`}>{alert.message}</div>}
      {isLocked && (
        <div className="lock-notice">Temporary lock active. Try again in {lockSeconds}s.</div>
      )}

      {activeSection === 'withdraw' && (
        <section className="panel">
          <h2>💰 {t.withdraw}</h2>
          {withdrawType === 'representative' && selectedMember && (
            <p className="tagline">
              {t.withdrawAsRep} <strong>{selectedMember.name}</strong> ({selectedMember.status})
            </p>
          )}

          <nav className="stepper">
            {withdrawSteps.map((item, idx) => {
              const isCurrent = item.key === withdrawStep
              const isCompleted = idx < currentStepIdx
              const clickable = canNavigateToStep(item.key)
              return (
                <button
                  key={item.key}
                  type="button"
                  className={[
                    'stepper-btn',
                    isCurrent ? 'active' : '',
                    isCompleted ? 'completed' : '',
                    clickable ? 'clickable' : '',
                  ].join(' ')}
                  onClick={() => navigateToStep(item.key)}
                  disabled={!clickable && !isCurrent}
                >
                  <span className="step-num">{idx + 1}</span>
                  <span className="step-label">{item.label}</span>
                </button>
              )
            })}
          </nav>

          {withdrawStep === 'identity' && (
            <div className="form-grid">
              <label>
                Pensioner No
                <input
                  value={identityForm.pensionerNo}
                  onChange={(event) =>
                    setIdentityForm((prev) => ({ ...prev, pensionerNo: event.target.value }))
                  }
                  placeholder="Eg: 233242319364"
                  disabled={isAnyLoading}
                />
                {renderError('pensionerNo')}
              </label>
              <label>
                Pension Card No
                <input
                  value={identityForm.pensionCardNo}
                  onChange={(event) =>
                    setIdentityForm((prev) => ({ ...prev, pensionCardNo: event.target.value.toUpperCase() }))
                  }
                  placeholder="Eg: PC-100923"
                  disabled={isAnyLoading}
                />
                {renderError('pensionCardNo')}
              </label>
              <label>
                OTP
                <input
                  value={identityForm.otpInput}
                  onChange={(event) =>
                    setIdentityForm((prev) => ({ ...prev, otpInput: event.target.value }))
                  }
                  placeholder="Enter OTP"
                  disabled={isAnyLoading}
                />
                {renderError('otpInput')}
              </label>
              <div className="helper-row">
                <small>OTP requests left: {Math.max(0, 3 - otpMeta.requestCount)}</small>
                {otpSeconds > 0 && <small>OTP expires in: {otpSeconds}s</small>}
                {otpMeta.verifyFailures > 0 && <small>OTP retries used: {otpMeta.verifyFailures}/3</small>}
              </div>
              {otpCode && <small className="demo-otp">Demo OTP: {otpCode}</small>}
              <div className="row-actions">
                <button type="button" onClick={requestOtp} disabled={isAnyLoading || isLocked}>
                  {isBusy('requestOtp') ? 'Sending...' : t.getOtp}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={verifyOtpAndContinue}
                  disabled={isAnyLoading || isLocked}
                >
                  {isBusy('verifyOtp') ? 'Verifying...' : t.continue}
                </button>
                {withdrawType === 'representative' && (
                  <button type="button" onClick={backToDashboard} disabled={isAnyLoading}>
                    Switch to Self
                  </button>
                )}
              </div>
            </div>
          )}

          {withdrawStep === 'biometric' && (
            <div className="stack">
              <h3>🔐 Biometric Verify</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Position your face within the frame and follow the liveness prompts.</p>

              <div className="camera-container">
                <div className="camera-frame">
                  {biometricState.cameraPermission === 'granted' ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="camera-video"
                    />
                  ) : (
                    <div className="camera-placeholder">
                      <span>📷</span>
                      <p>Camera off</p>
                    </div>
                  )}
                  <div className={`face-oval ${biometricState.faceDetected ? 'face-found' : ''}`} />
                  {biometricState.cameraPermission === 'granted' && (
                    <div className={`face-indicator ${biometricState.faceDetected ? 'detected' : 'not-detected'}`}>
                      {biometricState.faceDetected ? '✅ Human Face Detected' : '🔍 Searching for face...'}
                    </div>
                  )}
                  {biometricState.scanning && (
                    <div className="scan-overlay">
                      <p className="scan-prompt">{biometricState.currentPrompt}</p>
                      <span className="scan-countdown">{biometricState.scanCountdown}</span>
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              <div className="biometric-box">
                <div className="biometric-row">
                  <span>Camera</span>
                  <strong className={biometricState.cameraPermission === 'granted' ? 'text-green' : ''}>
                    {biometricState.cameraPermission === 'granted' ? 'ACTIVE' : biometricState.cameraPermission.toUpperCase()}
                  </strong>
                </div>
                <div className="biometric-row">
                  <span>Human Detection</span>
                  <strong className={biometricState.faceDetected ? 'text-green' : 'text-warn'}>
                    {biometricState.cameraPermission !== 'granted'
                      ? 'WAITING'
                      : biometricState.faceDetected
                        ? `CONFIRMED (${biometricState.faceConfidence}%)`
                        : 'NOT FOUND'}
                  </strong>
                </div>
                <div className="biometric-row">
                  <span>Face Quality</span>
                  <strong>{biometricState.qualityScore}%</strong>
                </div>
                <div className="progress-track">
                  <div style={{ width: `${biometricState.qualityScore}%` }} className="progress-fill" />
                </div>

                <div className="liveness-checks">
                  <div className={`liveness-item ${biometricState.faceDetected ? 'done' : ''}`}>
                    {biometricState.faceDetected ? '✅' : '⬜'} Human Check
                  </div>
                  <div className={`liveness-item ${biometricState.blinkCheck ? 'done' : ''}`}>
                    {biometricState.blinkCheck ? '✅' : '⬜'} Blink
                  </div>
                  <div className={`liveness-item ${biometricState.leftTurnCheck ? 'done' : ''}`}>
                    {biometricState.leftTurnCheck ? '✅' : '⬜'} Turn Left
                  </div>
                  <div className={`liveness-item ${biometricState.rightTurnCheck ? 'done' : ''}`}>
                    {biometricState.rightTurnCheck ? '✅' : '⬜'} Turn Right
                  </div>
                </div>

                <div className="row-actions">
                  {biometricState.cameraPermission !== 'granted' && (
                    <button
                      type="button"
                      className="primary"
                      onClick={requestCameraPermission}
                      disabled={isAnyLoading}
                    >
                      {isBusy('cameraPermission') ? 'Starting Camera...' : 'Enable Camera'}
                    </button>
                  )}
                  {biometricState.cameraPermission === 'granted' && biometricState.faceDetected && !biometricState.blinkCheck && (
                    <button
                      type="button"
                      onClick={() => runLivenessCheck('blinkCheck')}
                      disabled={biometricState.scanning}
                    >
                      {biometricState.scanning && biometricState.currentPrompt.includes('blink')
                        ? `Scanning... ${biometricState.scanCountdown}s`
                        : 'Start Blink Check'}
                    </button>
                  )}
                  {biometricState.cameraPermission === 'granted' && !biometricState.faceDetected && (
                    <p style={{ color: 'var(--kbz-gold)', fontSize: '0.82rem', fontWeight: 500, margin: 0 }}>
                      ⚠️ Position your face in the oval to continue
                    </p>
                  )}
                  {biometricState.blinkCheck && !biometricState.leftTurnCheck && (
                    <button
                      type="button"
                      onClick={() => runLivenessCheck('leftTurnCheck')}
                      disabled={biometricState.scanning}
                    >
                      {biometricState.scanning && biometricState.currentPrompt.includes('left')
                        ? `Scanning... ${biometricState.scanCountdown}s`
                        : 'Start Turn Left'}
                    </button>
                  )}
                  {biometricState.leftTurnCheck && !biometricState.rightTurnCheck && (
                    <button
                      type="button"
                      onClick={() => runLivenessCheck('rightTurnCheck')}
                      disabled={biometricState.scanning}
                    >
                      {biometricState.scanning && biometricState.currentPrompt.includes('right')
                        ? `Scanning... ${biometricState.scanCountdown}s`
                        : 'Start Turn Right'}
                    </button>
                  )}
                </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Attempts used: {biometricState.attempts}/3</small>
              </div>

              <div className="row-actions">
                <button type="button" onClick={goBackStep} disabled={isAnyLoading || biometricState.scanning}>
                  {t.back}
                </button>
                <button
                  className="primary"
                  type="button"
                  onClick={verifyFace}
                  disabled={isAnyLoading || !biometricPassed}
                >
                  {isBusy('verifyFace') ? 'Verifying...' : t.verifyFace}
                </button>
              </div>
            </div>
          )}

          {withdrawStep === 'review' && receiptData === null && (
            <div className="stack">
              <h3>📋 Review Information</h3>
              <ul className="review-list">
                <li>
                  <span>Pension Card No</span>
                  <strong>{maskData ? hideSensitive(currentProfile.pensionCardNo, 3) : currentProfile.pensionCardNo}</strong>
                </li>
                <li><span>Pensioner Name</span><strong>{currentProfile.name}</strong></li>
                <li>
                  <span>NRC No</span>
                  <strong>{maskData ? hideSensitive(currentProfile.nrcNo, 4) : currentProfile.nrcNo}</strong>
                </li>
                <li><span>Payment Date</span><strong>For 9 months</strong></li>
                <li><span>Pension Amount</span><strong>400,000 MMK</strong></li>
                <li><span>Allowance</span><strong>50,000 MMK</strong></li>
                <li><span>Transaction Fee (1%)</span><strong>4,500 MMK</strong></li>
                <li><span>Total Payment</span><strong>445,500 MMK</strong></li>
              </ul>

              <div className="row-actions">
                <button type="button" onClick={() => setMaskData((prev) => !prev)} disabled={isAnyLoading}>
                  {maskData ? 'Show Full Details' : 'Mask Sensitive Data'}
                </button>
              </div>

              <div className="consent-box">
                <label className="check-item">
                  <input
                    type="checkbox"
                    checked={reviewChecks.identity}
                    onChange={(event) => {
                      setReviewChecks((prev) => ({ ...prev, identity: event.target.checked }))
                      setFieldErrors((prev) => ({ ...prev, reviewConsent: '' }))
                    }}
                    disabled={isAnyLoading}
                  />
                  <span>I confirm pensioner identity and details are correct.</span>
                </label>
                <label className="check-item">
                  <input
                    type="checkbox"
                    checked={reviewChecks.fee}
                    onChange={(event) => {
                      setReviewChecks((prev) => ({ ...prev, fee: event.target.checked }))
                      setFieldErrors((prev) => ({ ...prev, reviewConsent: '' }))
                    }}
                    disabled={isAnyLoading}
                  />
                  <span>I accept the transaction fee and authorize this withdrawal.</span>
                </label>
                {renderError('reviewConsent')}
              </div>

              <label>
                Enter 6-digit PIN for confirmation
                <input
                  type="password"
                  maxLength={6}
                  value={identityForm.pin}
                  onChange={(event) => {
                    setIdentityForm((prev) => ({ ...prev, pin: event.target.value }))
                    setFieldErrors((prev) => ({ ...prev, pin: '' }))
                  }}
                  placeholder="******"
                  disabled={isAnyLoading}
                />
                {renderError('pin')}
              </label>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>PIN retries used: {pinFailures}/3</small>
              <div className="row-actions">
                <button type="button" onClick={goBackStep} disabled={isAnyLoading}>
                  {t.back}
                </button>
                <button
                  className="primary"
                  type="button"
                  onClick={confirmWithdrawal}
                  disabled={isAnyLoading}
                >
                  {isBusy('confirmWithdrawal') ? 'Processing...' : t.confirm}
                </button>
              </div>
            </div>
          )}

          {withdrawStep === 'success' && receiptData && (
            <div className="stack success-box">
              <div className="success-icon">✓</div>
              <h3>Pension Withdrawn Successfully</h3>
              <div className="success-amount">{receiptData.totalPayment.toLocaleString()} MMK</div>

              <div className="receipt-details">
                <p><span>Order No</span> <strong>{receiptData.orderNo}</strong></p>
                <p><span>Time</span> <strong>{new Date(receiptData.timestamp).toLocaleString()}</strong></p>
                <p>
                  <span>Transaction Ref</span>
                  <strong>{`${receiptData.orderNo}-${receiptData.profile.pensionCardNo.slice(-3)}`}</strong>
                </p>
                <p><span>Pensioner</span> <strong>{receiptData.profile.name}</strong></p>
                <p><span>Card No</span> <strong>{receiptData.profile.pensionCardNo}</strong></p>
              </div>

              {(copiedRef || sharedSummary) && (
                <small className="success-note">
                  {copiedRef ? '✓ Reference copied' : ''} {sharedSummary ? '✓ Summary shared' : ''}
                </small>
              )}
              <div className="row-actions" style={{ justifyContent: 'center' }}>
                <button type="button" onClick={handleSaveReceipt}>
                  📄 {t.saveReceipt}
                </button>
                <button type="button" onClick={copyTransactionRef}>
                  📋 Copy Ref
                </button>
                <button type="button" onClick={shareSummary}>
                  📤 Share
                </button>
              </div>
              <button type="button" className="primary" onClick={backToDashboard} style={{ width: '100%' }}>
                {t.done}
              </button>
            </div>
          )}
        </section>
      )}

      {activeSection === 'representative' && (
        <section className="panel">
          <h2>👥 {t.representative}</h2>

          <div className="split">
            <div>
              <h3>📜 Pensioners List</h3>
              {membersLoading && <p>Loading members...</p>}
              <ul className="member-list">
                {sortedMembers.map((member) => (
                  <li key={member.id}>
                    <div>
                      <strong>{member.name}</strong>
                      <p>
                        {member.pensionCardNo} • {member.relationship}
                      </p>
                      <small className={`status-badge ${statusClass(member.status)}`}>{member.status}</small>
                    </div>
                    {member.status === 'APPROVED' ? (
                      <button
                        type="button"
                        onClick={() => startRepresentativeWithdraw(member)}
                        disabled={isAnyLoading}
                      >
                        {t.withdraw}
                      </button>
                    ) : (
                      <span className="wait-note">{t.waitApproval}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={handleAddPensioner}>
              <h3>➕ {t.addPensioner}</h3>
              <label>
                Pensioner No
                <input
                  value={newMemberForm.pensionerNo}
                  onChange={(event) =>
                    setNewMemberForm((prev) => ({ ...prev, pensionerNo: event.target.value }))
                  }
                  disabled={isAnyLoading}
                />
                {renderError('newPensionerNo')}
              </label>
              <label>
                Pension Card No
                <input
                  value={newMemberForm.pensionCardNo}
                  onChange={(event) =>
                    setNewMemberForm((prev) => ({ ...prev, pensionCardNo: event.target.value.toUpperCase() }))
                  }
                  disabled={isAnyLoading}
                />
                {renderError('newPensionCardNo')}
              </label>
              <label>
                Name
                <input
                  value={newMemberForm.name}
                  onChange={(event) =>
                    setNewMemberForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  disabled={isAnyLoading}
                />
                {renderError('newName')}
              </label>
              <label>
                NRC No
                <input
                  value={newMemberForm.nrcNo}
                  onChange={(event) =>
                    setNewMemberForm((prev) => ({ ...prev, nrcNo: event.target.value }))
                  }
                  disabled={isAnyLoading}
                />
                {renderError('newNrc')}
              </label>
              <label>
                Relationship
                <input
                  value={newMemberForm.relationship}
                  onChange={(event) =>
                    setNewMemberForm((prev) => ({ ...prev, relationship: event.target.value }))
                  }
                  disabled={isAnyLoading}
                />
                {renderError('newRelationship')}
              </label>
              <label>
                Enter 6-digit PIN for confirmation
                <input
                  type="password"
                  maxLength={6}
                  value={newMemberForm.pin}
                  onChange={(event) =>
                    setNewMemberForm((prev) => ({ ...prev, pin: event.target.value }))
                  }
                  placeholder="******"
                  disabled={isAnyLoading}
                />
                {renderError('newPin')}
              </label>
              <button className="primary" type="submit" disabled={isAnyLoading || isLocked}>
                {isBusy('submitRep') ? 'Submitting...' : t.submitRequest}
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  )
}

export default App
