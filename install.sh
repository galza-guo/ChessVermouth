#!/bin/bash

# ChessVermouth macOS Installation Script
# One-click setup for macOS users

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}♟️  ChessVermouth Installer for macOS${NC}"
echo -e "${BLUE}====================================${NC}"
echo ""

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ This installer is optimized for macOS${NC}"
    echo "Please use the general setup script instead: node chessvermouth.js"
    exit 1
fi

# Function to print status
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if Node.js is installed
check_nodejs() {
    print_status "Checking Node.js installation..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
        return 0
    else
        print_warning "Node.js not found"
        return 1
    fi
}

# Install Node.js via Homebrew
install_nodejs() {
    print_status "Installing Node.js..."
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        print_status "Homebrew not found. Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Add Homebrew to PATH if not already there
        if [[ -f /opt/homebrew/bin/brew ]]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    fi
    
    # Install Node.js
    brew install node
    
    if check_nodejs; then
        print_success "Node.js installed successfully!"
        
        # macOS notification
        osascript -e 'display notification "Node.js installation complete" with title "ChessVermouth" sound name "Glass"'
    else
        print_error "Failed to install Node.js"
        exit 1
    fi
}

# Create desktop shortcut
create_desktop_shortcut() {
    print_status "Creating desktop shortcut..."
    
    DESKTOP_PATH="$HOME/Desktop"
    SCRIPT_PATH="$(pwd)/chessvermouth.js"
    
    # Create AppleScript to run the Node.js script
    cat > "$DESKTOP_PATH/ChessVermouth.app" << 'EOF'
#!/usr/bin/env osascript

-- Get the directory where the script is located
set scriptPath to POSIX path of (path to me as string)
set scriptDir to do shell script "dirname " & quoted form of scriptPath

-- Run the chessvermouth.js script
do shell script "cd " & quoted form of scriptDir & " && node chessvermouth.js"
EOF

    # Make it executable
    chmod +x "$DESKTOP_PATH/ChessVermouth.app"
    
    print_success "Desktop shortcut created!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing game dependencies..."
    
    # Install server dependencies
    print_status "Installing server dependencies..."
    cd server && npm install && cd ..
    
    # Install client dependencies  
    print_status "Installing client dependencies..."
    cd client && npm install && cd ..
    
    print_success "All dependencies installed!"
    
    # macOS notification
    osascript -e 'display notification "Game dependencies installed" with title "ChessVermouth" sound name "Glass"'
}

# Create Applications shortcut
create_applications_shortcut() {
    print_status "Creating Applications shortcut..."
    
    APP_NAME="ChessVermouth.app"
    APP_PATH="/Applications/$APP_NAME"
    SCRIPT_DIR="$(pwd)"
    
    # Create the app bundle structure
    mkdir -p "$APP_PATH/Contents/MacOS"
    mkdir -p "$APP_PATH/Contents/Resources"
    
    # Create Info.plist
    cat > "$APP_PATH/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>ChessVermouth</string>
    <key>CFBundleDisplayName</key>
    <string>ChessVermouth</string>
    <key>CFBundleIdentifier</key>
    <string>com.chessvermouth.app</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleExecutable</key>
    <string>ChessVermouth</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
EOF

    # Create the launcher script
    cat > "$APP_PATH/Contents/MacOS/ChessVermouth" << EOF
#!/bin/bash
SCRIPT_DIR="$SCRIPT_DIR"
cd "\$SCRIPT_DIR"
/usr/bin/env node chessvermouth.js
EOF

    chmod +x "$APP_PATH/Contents/MacOS/ChessVermouth"
    
    print_success "Applications shortcut created!"
}

# Main installation process
main() {
    echo -e "${BLUE}Starting ChessVermouth installation...${NC}"
    echo ""
    
    # Check if we're in the right directory
    if [[ ! -f "chessvermouth.js" ]] || [[ ! -d "server" ]] || [[ ! -d "client" ]]; then
        print_error "Please run this script from the ChessVermouth root directory"
        echo "Current directory: $(pwd)"
        echo "Expected files: chessvermouth.js, server/, client/"
        exit 1
    fi
    
    # macOS notification for start
    osascript -e 'display notification "Starting ChessVermouth installation" with title "ChessVermouth" sound name "Glass"'
    
    # Check/install Node.js
    if ! check_nodejs; then
        install_nodejs
    fi
    
    # Install dependencies
    install_dependencies
    
    # Create shortcuts
    create_desktop_shortcut
    create_applications_shortcut
    
    # Final notification
    osascript -e 'display notification "Installation complete! Double-click ChessVermouth to play." with title "ChessVermouth" sound name "Glass"'
    
    echo ""
    echo -e "${GREEN}🎉 Installation complete!${NC}"
    echo ""
    echo "You can now launch ChessVermouth by:"
    echo "• Double-clicking ChessVermouth on your Desktop"
    echo "• Double-clicking ChessVermouth in Applications"
    echo "• Running: ./chessvermouth.js"
    echo ""
    echo "The game will open in your web browser at: http://localhost:5173"
    echo ""
    echo -e "${BLUE}Enjoy playing chess! ♟️${NC}"
    
    # Ask if they want to launch now
    echo ""
    read -p "Would you like to launch ChessVermouth now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        node chessvermouth.js
    fi
}

# Handle errors
trap 'print_error "Installation failed on line $LINENO"' ERR

# Run main function
main "$@"