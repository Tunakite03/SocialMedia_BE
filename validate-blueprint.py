#!/usr/bin/env python3
"""
Render Blueprint Validator
Giúp kiểm tra render.yaml trước khi deploy
"""

import sys
import json
import re
from pathlib import Path
from typing import List, Tuple

class Colors:
    """ANSI color codes"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_success(msg: str):
    """In thông báo thành công"""
    print(f"{Colors.GREEN}✓ {msg}{Colors.RESET}")

def print_error(msg: str):
    """In thông báo lỗi"""
    print(f"{Colors.RED}✗ {msg}{Colors.RESET}")

def print_warning(msg: str):
    """In thông báo cảnh báo"""
    print(f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}")

def print_info(msg: str):
    """In thông báo thông tin"""
    print(f"{Colors.BLUE}ℹ {msg}{Colors.RESET}")

def print_header(msg: str):
    """In header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}{Colors.RESET}\n")

def load_render_yaml(filepath: Path) -> dict:
    """Check if render.yaml exists and has basic structure"""
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Check for required sections using regex
        has_services = re.search(r'^\s*services\s*:', content, re.MULTILINE)
        has_databases = re.search(r'^\s*databases\s*:', content, re.MULTILINE)
        
        return {
            'content': content,
            'has_services': bool(has_services),
            'has_databases': bool(has_databases),
        }
    except FileNotFoundError:
        print_error(f"File not found: {filepath}")
        sys.exit(1)

def validate_render_yaml(content: str) -> Tuple[bool, List[str]]:
    """Validate render.yaml content"""
    errors = []
    
    # Check for required sections
    if 'services:' not in content:
        errors.append("Missing 'services:' section")
    
    # Check for web services
    if 'type: web' not in content:
        errors.append("Missing 'type: web' declaration")
    
    # Check for Node.js service
    if 'runtime: node' not in content:
        errors.append("Missing 'runtime: node' (Node.js service)")
    
    # Check for required build/start commands
    if 'buildCommand:' not in content:
        errors.append("Missing 'buildCommand:' in render.yaml")
    
    if 'startCommand:' not in content:
        errors.append("Missing 'startCommand:' in render.yaml")
    
    # Check for database section
    if 'databases:' not in content:
        errors.append("Missing 'databases:' section")
    
    # Check for environment variables
    if 'envVars:' not in content:
        errors.append("Missing 'envVars:' section")
    
    return len(errors) == 0, errors

def validate_file_structure(base_path: Path) -> Tuple[bool, List[str]]:
    """Validate required files exist"""
    errors = []
    warnings = []
    
    required_files = {
        'package.json': 'Node.js dependencies',
        'src/app.js': 'Main application file',
        'prisma/schema.prisma': 'Prisma schema',
    }
    
    optional_files = {
        '.gitignore': 'Git ignore file',
        'README.md': 'Documentation',
    }
    
    print_info("Checking file structure...")
    
    for filename, description in required_files.items():
        filepath = base_path / filename
        if filepath.exists():
            print_success(f"Found {filename}")
        else:
            errors.append(f"Missing required file: {filename} ({description})")
    
    for filename, description in optional_files.items():
        filepath = base_path / filename
        if filepath.exists():
            print_success(f"Found {filename}")
        else:
            warnings.append(f"Missing optional file: {filename} ({description})")
    
    return len(errors) == 0, errors + warnings

def check_package_json(base_path: Path) -> Tuple[bool, List[str]]:
    """Check package.json for required fields"""
    errors = []
    warnings = []
    
    pkg_path = base_path / 'package.json'
    if not pkg_path.exists():
        return False, ["package.json not found"]
    
    try:
        import json
        with open(pkg_path, 'r') as f:
            package = json.load(f)
        
        print_info("Checking package.json...")
        
        # Check required fields
        if 'name' not in package:
            errors.append("package.json missing 'name'")
        if 'main' not in package and 'start' not in package.get('scripts', {}):
            errors.append("package.json missing 'main' or 'start' script")
        
        # Check Node.js version
        if 'engines' not in package:
            warnings.append("package.json missing 'engines' field (should specify Node.js version)")
        elif 'node' not in package.get('engines', {}):
            warnings.append("package.json 'engines' missing 'node' field")
        
        # Check dependencies
        if 'dependencies' not in package or len(package.get('dependencies', {})) == 0:
            warnings.append("package.json has no dependencies")
        
        print_success("package.json validated")
        
    except json.JSONDecodeError as e:
        errors.append(f"Invalid JSON in package.json: {e}")
    
    return len(errors) == 0, errors + warnings

def check_prisma_schema(base_path: Path) -> Tuple[bool, List[str]]:
    """Check Prisma schema"""
    errors = []
    warnings = []
    
    schema_path = base_path / 'prisma/schema.prisma'
    if not schema_path.exists():
        return False, ["Prisma schema not found at prisma/schema.prisma"]
    
    print_info("Checking Prisma schema...")
    
    with open(schema_path, 'r') as f:
        content = f.read()
    
    # Check for required sections
    if 'generator client' not in content:
        errors.append("Prisma schema missing 'generator client'")
    if 'datasource db' not in content:
        errors.append("Prisma schema missing 'datasource db'")
    if 'DATABASE_URL' not in content:
        errors.append("Prisma schema should use DATABASE_URL env var")
    
    print_success("Prisma schema validated")
    
    return len(errors) == 0, errors + warnings

def main():
    """Main validation function"""
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("╔════════════════════════════════════════╗")
    print("║  Render Blueprint Validator            ║")
    print("║  Kiểm tra render.yaml trước deployment ║")
    print("╚════════════════════════════════════════╝")
    print(Colors.RESET)
    
    # Get base path
    base_path = Path.cwd()
    render_yaml_path = base_path / 'render.yaml'
    
    # Check if render.yaml exists
    if not render_yaml_path.exists():
        print_error(f"render.yaml not found in {base_path}")
        sys.exit(1)
    
    all_valid = True
    all_issues = []
    
    # Validate render.yaml
    print_header("1. Validating render.yaml")
    config = load_render_yaml(render_yaml_path)
    
    if config['has_services']:
        print_success("✓ services section found")
    else:
        print_error("✗ services section missing")
        all_valid = False
    
    if config['has_databases']:
        print_success("✓ databases section found")
    else:
        print_warning("⚠ databases section missing")
    
    valid, issues = validate_render_yaml(config['content'])
    all_valid = all_valid and valid
    all_issues.extend(issues)
    
    # Validate file structure
    print_header("2. Validating File Structure")
    valid, issues = validate_file_structure(base_path)
    all_valid = all_valid and valid
    all_issues.extend(issues)
    
    # Check package.json
    print_header("3. Validating package.json")
    valid, issues = check_package_json(base_path)
    all_valid = all_valid and valid
    all_issues.extend(issues)
    
    # Check Prisma schema
    print_header("4. Validating Prisma Schema")
    valid, issues = check_prisma_schema(base_path)
    all_valid = all_valid and valid
    all_issues.extend(issues)
    
    # Print summary
    print_header("Validation Summary")
    
    if all_valid:
        print_success("All validations passed!")
        print(f"\n{Colors.GREEN}✓ Your render.yaml is ready for Blueprint deployment!{Colors.RESET}\n")
        print("📋 Next steps:")
        print("  1. git add render.yaml")
        print("  2. git commit -m 'Ready for Blueprint deployment'")
        print("  3. git push origin main")
        print("  4. Visit: https://render.com")
        print("  5. Click: New + → Blueprint → Connect repository")
        print()
        sys.exit(0)
    else:
        print_error("Some validations failed!")
        print(f"\n{Colors.RED}Issues found:{Colors.RESET}")
        for issue in all_issues:
            print(f"  • {issue}")
        print(f"\n{Colors.YELLOW}Please fix the above issues before deploying.{Colors.RESET}\n")
        sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        sys.exit(1)
