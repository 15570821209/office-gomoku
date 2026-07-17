"""零依赖的五子棋局域网服务。运行：python server.py"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import secrets
import socket
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
ROOMS: dict[str, dict] = {}
LOCK = threading.RLock()
BOARD_SIZE = 15
GAME_SPECS = {"gomoku": (15, 15, 5), "connect4": (6, 7, 4)}


def new_board(game_type: str = "gomoku") -> list[list[int]]:
    rows, cols, _ = GAME_SPECS.get(game_type, GAME_SPECS["gomoku"])
    return [[0 for _ in range(cols)] for _ in range(rows)]


def room_view(room: dict, player_id: str = "") -> dict:
    players = [{"name": p["name"], "color": p["color"]} for p in room["players"].values()]
    public_moves = [{key: move[key] for key in ("row", "col", "color")} for move in room["moves"]]
    me = room["players"].get(player_id)
    return {
        "code": room["code"], "type": room.get("type", "gomoku"),
        "board": room["board"], "turn": room["turn"],
        "winner": room["winner"], "winningCells": room["winning_cells"],
        "moves": public_moves, "version": room["version"], "players": players,
        "yourColor": me["color"] if me else 0, "signal": room["signal"],
        "createdAt": room["created_at"],
    }


def find_win(board: list[list[int]], row: int, col: int, color: int, target: int = 5) -> list[list[int]]:
    rows, cols = len(board), len(board[0])
    for dr, dc in ((1, 0), (0, 1), (1, 1), (1, -1)):
        cells = [[row, col]]
        for sign in (1, -1):
            r, c = row + dr * sign, col + dc * sign
            while 0 <= r < rows and 0 <= c < cols and board[r][c] == color:
                cells.append([r, c])
                r, c = r + dr * sign, c + dc * sign
        if len(cells) >= target:
            return cells
    return []


def local_ip() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"


class Handler(BaseHTTPRequestHandler):
    server_version = "BreakBoard/1.0"

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def send_json(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict:
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 8192)
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return {}

    def route_parts(self) -> list[str]:
        return [unquote(part) for part in urlparse(self.path).path.strip("/").split("/") if part]

    def do_GET(self) -> None:  # noqa: N802
        parts = self.route_parts()
        if parts == ["healthz"]:
            self.send_json({"status": "ok"})
            return
        if parts == ["api", "info"]:
            self.send_json({"lanIp": local_ip(), "port": self.server.server_port})
            return
        if len(parts) == 3 and parts[:2] == ["api", "rooms"]:
            code = parts[2].upper()
            player_id = self.headers.get("X-Player-Id", "")
            with LOCK:
                room = ROOMS.get(code)
                if not room:
                    self.send_json({"error": "房间不存在或已过期"}, 404)
                    return
                room["last_seen"] = time.time()
                self.send_json(room_view(room, player_id))
            return
        self.send_static(parts)

    def do_POST(self) -> None:  # noqa: N802
        parts = self.route_parts()
        data = self.read_json()
        if parts == ["api", "rooms"]:
            self.create_room(data)
            return
        if len(parts) == 4 and parts[:2] == ["api", "rooms"]:
            code, action = parts[2].upper(), parts[3]
            handlers = {"join": self.join_room, "move": self.play_move, "reset": self.reset_room,
                        "undo": self.undo_move, "signal": self.send_signal}
            if action in handlers:
                handlers[action](code, data)
                return
        self.send_json({"error": "接口不存在"}, 404)

    def create_room(self, data: dict) -> None:
        with LOCK:
            game_type = str(data.get("type", "gomoku"))
            if game_type not in GAME_SPECS:
                self.send_json({"error": "不支持这个游戏类型"}, 400); return
            while True:
                code = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))
                if code not in ROOMS:
                    break
            player_id = secrets.token_urlsafe(18)
            now = time.time()
            room = {"code": code, "type": game_type, "board": new_board(game_type), "turn": 1, "winner": 0,
                    "winning_cells": [], "moves": [], "version": 1,
                    "players": {player_id: {"name": clean_name(data.get("name")), "color": 1}},
                    "signal": None, "created_at": now, "last_seen": now}
            ROOMS[code] = room
            self.send_json({"playerId": player_id, **room_view(room, player_id)}, HTTPStatus.CREATED)

    def join_room(self, code: str, data: dict) -> None:
        with LOCK:
            room = ROOMS.get(code)
            if not room:
                self.send_json({"error": "没找到这个房间，请检查房间码"}, 404); return
            requested_type = str(data.get("type", ""))
            if requested_type and requested_type != room.get("type", "gomoku"):
                self.send_json({"error": "房间码属于另一款游戏"}, 409); return
            if len(room["players"]) >= 2:
                self.send_json({"error": "房间已经坐满两个人了"}, 409); return
            player_id = secrets.token_urlsafe(18)
            room["players"][player_id] = {"name": clean_name(data.get("name")), "color": 2}
            room["version"] += 1
            self.send_json({"playerId": player_id, **room_view(room, player_id)})

    def get_player(self, room: dict, data: dict) -> tuple[str, dict | None]:
        player_id = str(data.get("playerId", ""))
        return player_id, room["players"].get(player_id)

    def play_move(self, code: str, data: dict) -> None:
        with LOCK:
            room = ROOMS.get(code)
            if not room:
                self.send_json({"error": "房间已过期"}, 404); return
            player_id, player = self.get_player(room, data)
            game_type = room.get("type", "gomoku")
            row, col = data.get("row"), data.get("col")
            if not player:
                self.send_json({"error": "你不是这个房间的玩家"}, 403); return
            if len(room["players"]) < 2:
                self.send_json({"error": "等搭子进入后再落子"}, 409); return
            if room["winner"]:
                self.send_json({"error": "本局已经结束"}, 409); return
            if player["color"] != room["turn"]:
                self.send_json({"error": "还没轮到你"}, 409); return
            if game_type == "connect4":
                if not isinstance(col, int) or not 0 <= col < 7:
                    self.send_json({"error": "落子列无效"}, 400); return
                row = 5
                while row >= 0 and room["board"][row][col]:
                    row -= 1
                if row < 0:
                    self.send_json({"error": "这一列已经满了"}, 409); return
            elif not isinstance(row, int) or not isinstance(col, int) or not (0 <= row < 15 and 0 <= col < 15):
                self.send_json({"error": "落子位置无效"}, 400); return
            if room["board"][row][col]:
                self.send_json({"error": "这里已经有棋子了"}, 409); return
            color = player["color"]
            room["board"][row][col] = color
            room["moves"].append({"row": row, "col": col, "color": color, "playerId": player_id})
            winning = find_win(room["board"], row, col, color, GAME_SPECS[game_type][2])
            if winning:
                room["winner"], room["winning_cells"] = color, winning
            else:
                room["turn"] = 3 - color
            room["version"] += 1
            room["last_seen"] = time.time()
            self.send_json(room_view(room, player_id))

    def reset_room(self, code: str, data: dict) -> None:
        with LOCK:
            room = ROOMS.get(code)
            if not room or data.get("playerId") not in room["players"]:
                self.send_json({"error": "无法重开这个房间"}, 403); return
            room.update(board=new_board(room.get("type", "gomoku")), turn=1, winner=0, winning_cells=[], moves=[])
            room["version"] += 1
            self.send_json(room_view(room, data["playerId"]))

    def undo_move(self, code: str, data: dict) -> None:
        with LOCK:
            room = ROOMS.get(code)
            if not room or data.get("playerId") not in room["players"]:
                self.send_json({"error": "无法撤回"}, 403); return
            if not room["moves"]:
                self.send_json({"error": "还没有可以撤回的棋子"}, 409); return
            move = room["moves"].pop()
            room["board"][move["row"]][move["col"]] = 0
            room.update(turn=move["color"], winner=0, winning_cells=[])
            room["version"] += 1
            self.send_json(room_view(room, data["playerId"]))

    def send_signal(self, code: str, data: dict) -> None:
        with LOCK:
            room = ROOMS.get(code)
            player_id, player = self.get_player(room or {"players": {}}, data)
            if not room or not player:
                self.send_json({"error": "无法发送暗号"}, 403); return
            text = str(data.get("text", ""))[:30]
            room["signal"] = {"text": text, "from": player["name"], "id": secrets.token_hex(5), "at": time.time()}
            room["version"] += 1
            self.send_json(room_view(room, player_id))

    def send_static(self, parts: list[str]) -> None:
        relative = Path(*parts) if parts else Path("index.html")
        target = (ROOT / relative).resolve()
        if ROOT not in target.parents and target != ROOT:
            self.send_error(403); return
        if not target.is_file():
            target = ROOT / "index.html"
        content = target.read_bytes()
        mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{mime}; charset=utf-8" if mime.startswith("text/") else mime)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(content)


def clean_name(value: object) -> str:
    name = str(value or "摸鱼同事").strip()[:12]
    return name or "摸鱼同事"


def cleanup_loop() -> None:
    while True:
        time.sleep(1800)
        cutoff = time.time() - 12 * 3600
        with LOCK:
            for code in [key for key, room in ROOMS.items() if room["last_seen"] < cutoff]:
                ROOMS.pop(code, None)


def main() -> None:
    parser = argparse.ArgumentParser(description="五子棋局域网服务")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "8765")))
    args = parser.parse_args()
    threading.Thread(target=cleanup_loop, daemon=True).start()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print("\n  五子棋工作台已启动")
    print(f"  本机打开：http://127.0.0.1:{args.port}")
    print(f"  搭子打开：http://{local_ip()}:{args.port}")
    print("  按 Ctrl+C 停止\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
