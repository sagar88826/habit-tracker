// smoketest.go – HTTP smoke-test for the Habit Tracker web UI
//
// Usage:
//   go run scripts/smoketest.go [base_url]
//
// Default base URL: http://localhost:3000
//
// The script:
//   1. GETs every known route
//   2. Checks HTTP status codes (expect 200; redirects followed)
//   3. Scans the HTML body for Next.js / React error markers
//   4. Prints a concise pass/fail table + exits non-zero on any failure

package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// ─── colour helpers ──────────────────────────────────────────────────────────

const (
	green  = "\033[32m"
	red    = "\033[31m"
	yellow = "\033[33m"
	bold   = "\033[1m"
	reset  = "\033[0m"
)

func pass(s string) string { return green + "✓ " + s + reset }
func fail(s string) string { return red + "✗ " + s + reset }
func warn(s string) string { return yellow + "⚠ " + s + reset }

// ─── error markers ───────────────────────────────────────────────────────────

// These strings appear in Next.js error boundaries or server error pages.
var errorMarkers = []string{
	"Application error: a client-side exception has occurred",
	"Error: ",
	"Internal Server Error",
	"500 Internal Server Error",
	"Unhandled Runtime Error",
	"TypeError",
	"ReferenceError",
	"Cannot read properties of",
	"is not a function",
	"__NEXT_ERROR__",
	"digest:",          // Next.js server component error digest
}

// These strings should appear on a healthy page (any one is sufficient).
type check struct {
	route    string
	contains string // optional: substring that must appear in body
}

var routes = []check{
	{"/",           ""},             // redirects to /dashboard
	{"/dashboard",  "Weekly Summary"},
	{"/entries",    "Log Entry"},
	{"/activities", "Activities"},
	{"/kpi",        "KPI"},
	{"/fines",      "Fines"},
	{"/users",      "Users"},
}

// ─── main ────────────────────────────────────────────────────────────────────

func main() {
	base := "http://localhost:3000"
	if len(os.Args) > 1 {
		base = strings.TrimRight(os.Args[1], "/")
	}

	client := &http.Client{
		Timeout: 15 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) > 5 {
				return fmt.Errorf("too many redirects")
			}
			return nil // follow redirects
		},
	}

	fmt.Printf("\n%sHabit Tracker – Smoke Test%s\n", bold, reset)
	fmt.Printf("Base URL: %s\n\n", base)
	fmt.Printf("%-20s %-6s %-12s %s\n", "Route", "Status", "Body Check", "Details")
	fmt.Println(strings.Repeat("─", 72))

	totalFail := 0

	for _, c := range routes {
		url := base + c.route
		status, body, finalURL, err := get(client, url)

		routeLabel := c.route
		if len(routeLabel) > 18 {
			routeLabel = routeLabel[:18]
		}

		if err != nil {
			fmt.Printf("%-20s %-6s %-12s %s\n",
				routeLabel, "ERR", fail("request"), err.Error())
			totalFail++
			continue
		}

		// ── status check ──────────────────────────────────────────────────
		statusOK := status == 200
		statusLabel := fmt.Sprintf("%d", status)

		// ── error-marker scan ─────────────────────────────────────────────
		errFound := ""
		for _, marker := range errorMarkers {
			if strings.Contains(body, marker) {
				errFound = marker
				break
			}
		}

		// ── positive content check ────────────────────────────────────────
		contentOK := true
		if c.contains != "" {
			contentOK = strings.Contains(body, c.contains)
		}

		// ── result ────────────────────────────────────────────────────────
		var statusStr, bodyStr, details string

		if statusOK {
			statusStr = pass(statusLabel)
		} else {
			statusStr = fail(statusLabel)
			totalFail++
		}

		switch {
		case errFound != "":
			bodyStr = fail("ERROR")
			details = fmt.Sprintf("marker: %q", truncate(errFound, 40))
			totalFail++
		case !contentOK:
			bodyStr = warn("MISSING")
			details = fmt.Sprintf("expected %q", c.contains)
			totalFail++
		default:
			bodyStr = pass("OK")
			if finalURL != url {
				details = fmt.Sprintf("→ %s", finalURL)
			}
		}

		fmt.Printf("%-20s %-15s %-21s %s\n",
			routeLabel, statusStr, bodyStr, details)
	}

	fmt.Println(strings.Repeat("─", 72))
	if totalFail == 0 {
		fmt.Printf("\n%sAll checks passed.%s\n\n", green+bold, reset)
		os.Exit(0)
	} else {
		fmt.Printf("\n%s%d check(s) failed.%s\n\n", red+bold, totalFail, reset)
		os.Exit(1)
	}
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func get(client *http.Client, url string) (status int, body, finalURL string, err error) {
	resp, err := client.Get(url)
	if err != nil {
		return 0, "", url, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 512*1024)) // max 512 KB
	if err != nil {
		return resp.StatusCode, "", resp.Request.URL.String(), err
	}
	return resp.StatusCode, string(raw), resp.Request.URL.String(), nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
