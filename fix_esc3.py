with open('app.js', 'r') as f:
    content = f.read()

# The issue: replace(/'/g,''') - empty string replacement breaks parsing
# Fix: use ' as the HTML entity for single quote
old = "function esc(s){return String(s??'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/\"/g,'\"').replace(/'/g,''')}"
new = "function esc(s){return String(s??'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/\"/g,'\"').replace(/'/g,''')}"

if old in content:
    content = content.replace(old, new)
    with open('app.js', 'w') as f:
        f.write(content)
    print('Fixed!')
else:
    print('Pattern not found')
    idx = content.find('function esc')
    if idx >= 0:
        print('Found at:', idx)
        print(repr(content[idx:idx+150]))