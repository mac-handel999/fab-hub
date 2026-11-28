with open('app.js', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'function esc' in line:
        print('Found line', i+1)
        # Write the correct line with HTML entity for single quote (')
        lines[i] = "function esc(s){return String(s??'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/\"/g,'\"').replace(/'/g,''')}\n"
        break

with open('app.js', 'w') as f:
    f.writelines(lines)
print('Done')