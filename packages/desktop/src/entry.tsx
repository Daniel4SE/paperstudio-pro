if (location.pathname === "/loading") {
  import("./loading")
} else if (location.pathname === "/license") {
  import("./license")
} else {
  import("./")
}
