import { render } from "solid-js/web"
import { MetaProvider } from "@solidjs/meta"
import "@opencode-ai/app/index.css"
import { Font } from "@opencode-ai/ui/font"
import "./styles.css"
import { createSignal, onMount, onCleanup, Show } from "solid-js"
import { open as shellOpen } from "@tauri-apps/plugin-shell"
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link"
import { commands, events } from "./bindings"

const LICENSE_SERVER = "https://license.paperstudios.cc"

const root = document.getElementById("root")!

render(() => {
  const [status, setStatus] = createSignal<
    "idle" | "waiting" | "activating" | "success" | "error"
  >("idle")
  const [errorMsg, setErrorMsg] = createSignal("")
  const [email, setEmail] = createSignal("")

  const handleDeepLink = async (urls: string[]) => {
    for (const rawUrl of urls) {
      try {
        const parsed = new URL(rawUrl)
        const code =
          parsed.searchParams.get("activation_code") ||
          parsed.searchParams.get("code")
        if (!code) continue

        setStatus("activating")
        const result = await commands.activateLicense(code)
        if (result.isValid) {
          setStatus("success")
          setEmail(result.email ?? "")
          // Notify Rust backend to close this window and proceed
          setTimeout(() => {
            void events.licenseActivated.emit(null)
          }, 1500)
        } else {
          setStatus("error")
          setErrorMsg(
            result.error ?? "Activation failed. This account may have already been used.",
          )
        }
      } catch (e) {
        setStatus("error")
        setErrorMsg(String(e))
      }
    }
  }

  onMount(async () => {
    // Check for deep links already received at startup
    const startUrls = await getCurrent().catch(() => null)
    if (startUrls?.length) void handleDeepLink(startUrls)

    const unlisten = await onOpenUrl((urls) => void handleDeepLink(urls)).catch(
      () => undefined,
    )
    onCleanup(() => {
      unlisten?.()
    })
  })

  const startGoogleSignIn = () => {
    setStatus("waiting")
    setErrorMsg("")
    void shellOpen(`${LICENSE_SERVER}/auth/google`)
  }

  return (
    <MetaProvider>
      <div
        class="w-screen h-screen bg-background-base flex items-center justify-center select-none"
        data-tauri-drag-region
      >
        <Font />
        <div class="flex flex-col items-center gap-8 max-w-xs text-center px-8">
          {/* Logo */}
          <img
            src="/paperstudio-logo.png"
            class="w-24 h-24 object-contain"
            alt="PaperStudio Pro"
            draggable={false}
          />

          <div class="flex flex-col gap-2">
            <h1 class="text-xl font-semibold text-text-strong">
              PaperStudio Pro
            </h1>
            <p class="text-13-regular text-text-weak">
              Sign in with your Google account to activate your license.
              Each account can only be used once.
            </p>
          </div>

          {/* Idle / Error → Show sign-in button */}
          <Show when={status() === "idle" || status() === "error"}>
            <button
              onClick={startGoogleSignIn}
              class="flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
            >
              {/* Google G logo */}
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span class="text-sm font-medium text-gray-700">
                Sign in with Google
              </span>
            </button>
          </Show>

          {/* Waiting for browser callback */}
          <Show when={status() === "waiting"}>
            <div class="flex flex-col items-center gap-3">
              <div class="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <p class="text-13-regular text-text-weak">
                Waiting for Google sign-in...
              </p>
              <p class="text-11-regular text-text-weak opacity-60">
                Complete the sign-in in your browser, then return here.
              </p>
              <button
                onClick={() => setStatus("idle")}
                class="text-12-medium text-text-weak hover:text-text-base underline mt-2 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </Show>

          {/* Activating */}
          <Show when={status() === "activating"}>
            <div class="flex flex-col items-center gap-3">
              <div class="w-6 h-6 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
              <p class="text-13-regular text-text-weak">
                Activating license...
              </p>
            </div>
          </Show>

          {/* Success */}
          <Show when={status() === "success"}>
            <div class="flex flex-col items-center gap-3">
              <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  class="text-green-600"
                >
                  <path
                    d="M5 10l3.5 3.5L15 7"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <p class="text-14-medium text-green-700">License Activated</p>
              <Show when={email()}>
                <p class="text-12-regular text-text-weak">{email()}</p>
              </Show>
              <p class="text-11-regular text-text-weak opacity-60">
                Launching PaperStudio Pro...
              </p>
            </div>
          </Show>

          {/* Error message */}
          <Show when={status() === "error" && errorMsg()}>
            <div class="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-left">
              <p class="text-12-medium text-red-700">{errorMsg()}</p>
            </div>
          </Show>
        </div>
      </div>
    </MetaProvider>
  )
}, root)
