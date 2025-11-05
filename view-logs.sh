#!/bin/bash

# Script để xem logs một cách dễ dàng

LOG_DIR="logs"

case "$1" in
  "all"|"combined")
    echo "📋 Showing all logs (combined.log)..."
    echo "=================================================="
    if [ -f "$LOG_DIR/combined.log" ]; then
      tail -f "$LOG_DIR/combined.log"
    else
      echo "❌ Log file not found: $LOG_DIR/combined.log"
    fi
    ;;
  "error"|"errors")
    echo "🚨 Showing error logs (error.log)..."
    echo "=================================================="
    if [ -f "$LOG_DIR/error.log" ]; then
      tail -f "$LOG_DIR/error.log"
    else
      echo "❌ Log file not found: $LOG_DIR/error.log"
    fi
    ;;
  "search")
    if [ -z "$2" ]; then
      echo "❌ Please provide search term: ./view-logs.sh search \"term\""
      exit 1
    fi
    echo "🔍 Searching for: $2"
    echo "=================================================="
    grep -n "$2" "$LOG_DIR/combined.log" 2>/dev/null || echo "No results found"
    ;;
  "clear")
    echo "🧹 Clearing log files..."
    rm -f "$LOG_DIR/*.log"
    echo "✅ Log files cleared"
    ;;
  "size")
    echo "📊 Log file sizes:"
    echo "=================================================="
    ls -lh "$LOG_DIR"/*.log 2>/dev/null || echo "No log files found"
    ;;
  *)
    echo "📝 Otakomi Backend Log Viewer"
    echo "=================================================="
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  all, combined    - Show all logs (real-time)"
    echo "  error, errors    - Show error logs (real-time)"
    echo "  search <term>    - Search for specific term in logs"
    echo "  clear            - Clear all log files"
    echo "  size             - Show log file sizes"
    echo ""
    echo "Examples:"
    echo "  $0 all"
    echo "  $0 error"
    echo "  $0 search \"user login\""
    echo "  $0 clear"
    ;;
esac