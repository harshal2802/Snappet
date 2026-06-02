import type { TourStep } from '../../components/GuidedTour'

export const tourSteps: TourStep[] = [
  {
    title: 'Welcome to the QR Code Generator',
    body: "A quick tour of how to turn text, links, and more into a scannable QR code. It takes about 20 seconds — you can skip anytime.",
  },
  {
    target: 'format',
    title: 'Pick a format',
    body: 'Switch between plain text, a URL, WiFi credentials, or a contact card.',
  },
  {
    target: 'content',
    title: 'Enter your content',
    body: 'Fill in the fields here. The QR code updates live as you type.',
  },
  {
    target: 'level',
    title: 'Tune error correction',
    body: 'Higher levels pack more redundancy, so the code still scans even if it gets scuffed.',
  },
  {
    target: 'preview',
    title: 'Preview the code',
    body: 'Your QR code renders here — scan it with any phone or camera app.',
  },
  {
    target: 'actions',
    title: 'Download or share',
    body: 'Save it as a PNG, or share it directly where supported. Everything auto-saves on this device — use ↺ Reset to start over.',
  },
]
