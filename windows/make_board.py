# Turns dist/flapboard.html into board.c (a byte array the screensaver writes out at run time).
import os
here = os.path.dirname(os.path.abspath(__file__))
data = open(os.path.join(here, '..', 'dist', 'flapboard.html'), 'rb').read()
with open(os.path.join(here, 'board.c'), 'w') as f:
    f.write('const unsigned int BOARD_HTML_LEN = %d;\nconst unsigned char BOARD_HTML[] = {\n' % len(data))
    for i in range(0, len(data), 40): f.write(','.join(str(b) for b in data[i:i + 40]) + ',\n')
    f.write('0};\n')
