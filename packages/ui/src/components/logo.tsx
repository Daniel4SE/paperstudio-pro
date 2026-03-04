import { ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-mark-shadow" d="M4 4H12V8H4Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-mark-p" d="M4 4H12V8H4ZM0 0V20H4V12H16V0Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20 20H60V40H20Z" fill="var(--icon-base)" />
      <path d="M20 20H60V40H20ZM0 0V100H20V60H80V0Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <text
        x="0"
        y="31"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        font-size="28"
        font-weight="700"
        letter-spacing="-0.5"
      >
        <tspan fill="var(--icon-base)">Paper</tspan>
        <tspan fill="var(--icon-strong-base)">Studio Pro</tspan>
      </text>
    </svg>
  )
}
