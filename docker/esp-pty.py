#!/usr/bin/env python3
import fcntl
import os
import pty
import select
import signal
import struct
import sys
import termios

os.chdir("/workspace")
pid, master = pty.fork()
if pid == 0:
    os.environ.setdefault("TERM", "xterm-256color")
    os.environ.setdefault("LANG", "C.UTF-8")
    os.environ.setdefault("HOME", "/root")
    try:
        fd = sys.stdin.fileno()
        attrs = termios.tcgetattr(fd)
        attrs[3] |= termios.ECHO | termios.ECHOE | termios.ECHOK | termios.ICANON | termios.ISIG
        attrs[6][termios.VERASE] = 127
        termios.tcsetattr(fd, termios.TCSANOW, attrs)
    except termios.error:
        pass
    os.execv("/bin/bash", ["bash", "-il"])


def winsize(fd, rows, cols):
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", int(rows), int(cols), 0, 0))
    try:
        os.kill(pid, signal.SIGWINCH)
    except OSError:
        pass


winsize(master, 24, 80)

stdin_fd = sys.stdin.fileno()
stdout_fd = sys.stdout.fileno()
pending = b""
START = b"\x1e"
END = b"\x1f"


def from_client(chunk):
    global pending
    pending += chunk
    raw = b""
    while True:
        start = pending.find(START)
        if start < 0:
            raw += pending
            pending = b""
            break
        raw += pending[:start]
        end = pending.find(END, start + 1)
        if end < 0:
            pending = pending[start:]
            break
        payload = pending[start + 1 : end]
        pending = pending[end + 1 :]
        try:
            rows, cols = payload.decode("ascii").split(",")
            winsize(master, rows, cols)
        except Exception:
            pass
    if raw:
        os.write(master, raw)


while True:
    try:
        ready, _, _ = select.select([stdin_fd, master], [], [])
    except InterruptedError:
        continue
    if stdin_fd in ready:
        try:
            data = os.read(stdin_fd, 8192)
        except OSError:
            data = b""
        if not data:
            try:
                os.kill(pid, signal.SIGHUP)
            except OSError:
                pass
            break
        from_client(data)
    if master in ready:
        try:
            data = os.read(master, 8192)
        except OSError:
            break
        if not data:
            break
        os.write(stdout_fd, data)

try:
    os.waitpid(pid, 0)
except OSError:
    pass
