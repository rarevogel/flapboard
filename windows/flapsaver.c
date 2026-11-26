/* Flapboard screensaver for Windows.
 * Windows starts a .scr with  /s (show), /c (settings) or /p <hwnd> (little preview).
 * /s: the board (built into this file) is served on http://127.0.0.1:47815 by this program and shown full screen in Microsoft Edge
 *     (or Chrome) in kiosk mode, with its own profile so it never touches your normal browser. Other monitors go black.
 *     Any key press or mouse movement closes it.
 * /c: the same board in a normal window with the settings open; what you choose there is what the screensaver shows.
 * Build: python3 make_board.py && zig cc -target x86_64-windows-gnu -O2 -municode -Wl,--subsystem,windows flapsaver.c board.c -o Flapboard.scr  -luser32 -lshell32 -ladvapi32 -lgdi32 -lws2_32 -lwinhttp
 */
#define WIN32_LEAN_AND_MEAN
#include <winsock2.h>
#include <ws2tcpip.h>
#ifndef UNICODE
#define UNICODE
#endif
#define _UNICODE
#include <windows.h>
#include <shlobj.h>
#include <shellapi.h>
#include <wchar.h>
#include <winhttp.h>
#include <stdio.h>
#include <string.h>

#define PORT 47815

extern const unsigned char BOARD_HTML[];
extern const unsigned int BOARD_HTML_LEN;

static wchar_t dir[MAX_PATH], html[MAX_PATH], profile[MAX_PATH];

static int file_exists(const wchar_t *p) { DWORD a = GetFileAttributesW(p); return a != INVALID_FILE_ATTRIBUTES && !(a & FILE_ATTRIBUTE_DIRECTORY); }

static int find_browser(wchar_t *out, DWORD n) {
    const wchar_t *keys[] = { L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedge.exe",
                              L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe" };
    for (int k = 0; k < 2; k++) {
        HKEY roots[] = { HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER };
        for (int r = 0; r < 2; r++) {
            DWORD sz = n * sizeof(wchar_t), type;
            HKEY h;
            if (RegOpenKeyExW(roots[r], keys[k], 0, KEY_READ, &h) == ERROR_SUCCESS) {
                LONG ok = RegQueryValueExW(h, NULL, NULL, &type, (BYTE *)out, &sz);
                RegCloseKey(h);
                if (ok == ERROR_SUCCESS) { if (out[0] == L'"') { memmove(out, out + 1, sz); wchar_t *q = wcschr(out, L'"'); if (q) *q = 0; } if (file_exists(out)) return 1; }
            }
        }
    }
    const wchar_t *guess[] = { L"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", L"C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                               L"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" };
    for (int i = 0; i < 3; i++) if (file_exists(guess[i])) { wcsncpy(out, guess[i], n); return 1; }
    return 0;
}

static int prepare(void) {
    if (FAILED(SHGetFolderPathW(NULL, CSIDL_LOCAL_APPDATA, NULL, 0, dir))) return 0;
    wcscat(dir, L"\\Flapboard"); CreateDirectoryW(dir, NULL);
    swprintf(profile, MAX_PATH, L"%ls\\browser-profile", dir);
    return 1;
}

/* ---- a tiny local web server: the board itself, and a relay for live NS requests (adds the key as a header) */
static void send_all(SOCKET c, const char *b, int n) { while (n > 0) { int k = send(c, b, n, 0); if (k <= 0) return; b += k; n -= k; } }
static void reply(SOCKET c, int code, const char *ctype, const void *body, int len) {
    char h[256]; int n = snprintf(h, sizeof h, "HTTP/1.1 %d %s\r\nContent-Type: %s\r\nContent-Length: %d\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
                                  code, code == 200 ? "OK" : "Status", ctype, len);
    send_all(c, h, n); send_all(c, (const char *)body, len);
}
static void ns_relay(SOCKET c, const char *path) {     /* path: "/ns/reisinformatie-api/...?a=b&key=K" */
    char p[2048], key[256] = "", q[2048] = ""; strncpy(p, path + 4, sizeof p - 1); p[sizeof p - 1] = 0;
    char *qs = strchr(p, '?');
    if (qs) {
        *qs++ = 0;
        for (char *t = strtok(qs, "&"); t; t = strtok(NULL, "&")) {
            if (!strncmp(t, "key=", 4)) { strncpy(key, t + 4, sizeof key - 1); continue; }
            strncat(q, q[0] ? "&" : "?", sizeof q - strlen(q) - 1); strncat(q, t, sizeof q - strlen(q) - 1);
        }
    }
    /* undo %-escapes in the key */
    char k2[256]; int j = 0; for (int i = 0; key[i] && j < 255; i++) { if (key[i] == '%' && key[i + 1] && key[i + 2]) { char hx[3] = { key[i + 1], key[i + 2], 0 }; k2[j++] = (char)strtol(hx, NULL, 16); i += 2; } else k2[j++] = key[i]; } k2[j] = 0;
    wchar_t wpath[4200], whdr[400]; swprintf(wpath, 4200, L"/%hs%hs", p, q); swprintf(whdr, 400, L"Ocp-Apim-Subscription-Key: %hs\r\nAccept: application/json", k2);
    HINTERNET s = WinHttpOpen(L"Flapboard", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!s) s = WinHttpOpen(L"Flapboard", WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    HINTERNET cn = s ? WinHttpConnect(s, L"gateway.apiportal.ns.nl", INTERNET_DEFAULT_HTTPS_PORT, 0) : NULL;
    HINTERNET rq = cn ? WinHttpOpenRequest(cn, L"GET", wpath, NULL, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, WINHTTP_FLAG_SECURE) : NULL;
    int ok = rq && WinHttpSendRequest(rq, whdr, (DWORD)-1L, WINHTTP_NO_REQUEST_DATA, 0, 0, 0) && WinHttpReceiveResponse(rq, NULL);
    if (!ok) { reply(c, 502, "application/json", "{}", 2); }
    else {
        DWORD code = 0, sz = sizeof code; WinHttpQueryHeaders(rq, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, NULL, &code, &sz, NULL);
        char *buf = NULL; DWORD len = 0, avail = 0;
        while (WinHttpQueryDataAvailable(rq, &avail) && avail) {
            char *nb = realloc(buf, len + avail); if (!nb) break; buf = nb;
            DWORD got = 0; WinHttpReadData(rq, buf + len, avail, &got); len += got;
        }
        reply(c, (int)code, "application/json", buf ? buf : "{}", buf ? (int)len : 2); free(buf);
    }
    if (rq) WinHttpCloseHandle(rq); if (cn) WinHttpCloseHandle(cn); if (s) WinHttpCloseHandle(s);
}
static DWORD WINAPI client(LPVOID arg) {
    SOCKET c = (SOCKET)(UINT_PTR)arg; char req[4096]; int n = 0;
    while (n < (int)sizeof req - 1) { int k = recv(c, req + n, sizeof req - 1 - n, 0); if (k <= 0) break; n += k; req[n] = 0; if (strstr(req, "\r\n\r\n")) break; }
    req[n] = 0;
    char path[2048] = "";
    if (!strncmp(req, "GET ", 4)) { char *e = strchr(req + 4, ' '); if (e && e - (req + 4) < (int)sizeof path) { memcpy(path, req + 4, e - (req + 4)); path[e - (req + 4)] = 0; } }
    if (!strncmp(path, "/ns/", 4)) ns_relay(c, path);
    else if (!strcmp(path, "/") || !strncmp(path, "/flapboard.html", 15) || !strncmp(path, "/index.html", 11)) reply(c, 200, "text/html; charset=utf-8", BOARD_HTML, BOARD_HTML_LEN);
    else reply(c, 404, "text/plain", "not found", 9);
    shutdown(c, SD_SEND); closesocket(c);
    return 0;
}
static DWORD WINAPI server(LPVOID ls) {
    for (;;) { SOCKET c = accept((SOCKET)(UINT_PTR)ls, NULL, NULL); if (c == INVALID_SOCKET) return 0; HANDLE t = CreateThread(NULL, 0, client, (LPVOID)(UINT_PTR)c, 0, NULL); if (t) CloseHandle(t); else closesocket(c); }
}
/* start serving; if the port is taken another Flapboard is already serving the same board, which is fine */
static void serve(void) {
    WSADATA w; WSAStartup(MAKEWORD(2, 2), &w);
    SOCKET ls = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP); if (ls == INVALID_SOCKET) return;
    struct sockaddr_in a = { 0 }; a.sin_family = AF_INET; a.sin_port = htons(PORT); a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    BOOL excl = TRUE; setsockopt(ls, SOL_SOCKET, SO_EXCLUSIVEADDRUSE, (char *)&excl, sizeof excl);
    if (bind(ls, (struct sockaddr *)&a, sizeof a) || listen(ls, 16)) { closesocket(ls); return; }
    HANDLE t = CreateThread(NULL, 0, server, (LPVOID)(UINT_PTR)ls, 0, NULL); if (t) CloseHandle(t);
}

static void url_of(wchar_t *out, size_t n, const wchar_t *query) {
    swprintf(out, n, L"http://127.0.0.1:%d/flapboard.html?%ls", PORT, query);
}

static HANDLE job;
static PROCESS_INFORMATION launch(const wchar_t *browser, const wchar_t *args) {
    wchar_t cmd[4096];
    swprintf(cmd, 4096, L"\"%ls\" %ls", browser, args);
    STARTUPINFOW si = { sizeof si }; PROCESS_INFORMATION pi = { 0 };
    /* everything the browser starts lives in one job, so closing the job closes it all */
    job = CreateJobObjectW(NULL, NULL);
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION li = { 0 };
    li.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    SetInformationJobObject(job, JobObjectExtendedLimitInformation, &li, sizeof li);
    if (CreateProcessW(NULL, cmd, NULL, NULL, FALSE, CREATE_SUSPENDED, NULL, NULL, &si, &pi)) {
        AssignProcessToJobObject(job, pi.hProcess);
        ResumeThread(pi.hThread);
    }
    return pi;
}

/* black windows over the other monitors */
static LRESULT CALLBACK black_proc(HWND h, UINT m, WPARAM w, LPARAM l) {
    if (m == WM_SETCURSOR) { SetCursor(NULL); return TRUE; }
    return DefWindowProcW(h, m, w, l);
}
static BOOL CALLBACK each_monitor(HMONITOR mon, HDC dc, LPRECT r, LPARAM lp) {
    MONITORINFO mi = { sizeof mi }; GetMonitorInfoW(mon, &mi);
    if (mi.dwFlags & MONITORINFOF_PRIMARY) return TRUE;
    CreateWindowExW(WS_EX_TOPMOST | WS_EX_TOOLWINDOW, L"FlapBlack", L"", WS_POPUP | WS_VISIBLE,
                    r->left, r->top, r->right - r->left, r->bottom - r->top, NULL, NULL, (HINSTANCE)lp, NULL);
    return TRUE;
}

static int run_saver(HINSTANCE inst) {
    wchar_t browser[MAX_PATH], url[4 * MAX_PATH], args[4096];
    if (!prepare()) return 1;
    if (!find_browser(browser, MAX_PATH)) { MessageBoxW(NULL, L"The Flapboard screensaver needs Microsoft Edge or Google Chrome.", L"Flapboard", MB_ICONINFORMATION); return 1; }
    serve();
    WNDCLASSW wc = { 0 }; wc.lpfnWndProc = black_proc; wc.hInstance = inst; wc.lpszClassName = L"FlapBlack"; wc.hbrBackground = (HBRUSH)GetStockObject(BLACK_BRUSH);
    RegisterClassW(&wc);
    EnumDisplayMonitors(NULL, NULL, each_monitor, (LPARAM)inst);
    url_of(url, 4 * MAX_PATH, L"saver=1");
    swprintf(args, 4096, L"--kiosk \"%ls\" --edge-kiosk-type=fullscreen --user-data-dir=\"%ls\" --no-first-run --no-default-browser-check "
                         L"--autoplay-policy=no-user-gesture-required --disable-features=Translate,msEdgeSidebarV2 --noerrdialogs --disable-session-crashed-bubble --hide-crash-restore-bubble",
             url, profile);
    PROCESS_INFORMATION pi = launch(browser, args);
    if (!pi.hProcess) return 1;
    /* close on the first key press or mouse movement after a short settling time */
    LASTINPUTINFO li = { sizeof li };
    DWORD start = GetTickCount(); POINT p0; GetCursorPos(&p0);
    GetLastInputInfo(&li); DWORD last = li.dwTime;
    for (;;) {
        MSG m; while (PeekMessageW(&m, NULL, 0, 0, PM_REMOVE)) DispatchMessageW(&m);
        Sleep(50);
        if (GetTickCount() - start < 1500) { GetLastInputInfo(&li); last = li.dwTime; GetCursorPos(&p0); continue; }
        GetLastInputInfo(&li);
        POINT p; GetCursorPos(&p);
        int moved = abs(p.x - p0.x) > 6 || abs(p.y - p0.y) > 6;
        if (moved || li.dwTime != last) break;
    }
    TerminateJobObject(job, 0); CloseHandle(job);
    return 0;
}

static int run_settings(void) {
    wchar_t browser[MAX_PATH], url[4 * MAX_PATH], args[4096];
    if (!prepare()) return 1;
    if (!find_browser(browser, MAX_PATH)) { MessageBoxW(NULL, L"The Flapboard screensaver needs Microsoft Edge or Google Chrome.", L"Flapboard", MB_ICONINFORMATION); return 1; }
    serve();
    url_of(url, 4 * MAX_PATH, L"settings=1");
    swprintf(args, 4096, L"--app=\"%ls\" --user-data-dir=\"%ls\" --no-first-run --no-default-browser-check --window-size=1280,760", url, profile);
    PROCESS_INFORMATION pi = launch(browser, args);
    if (!pi.hProcess) return 1;
    /* keep serving the board until the settings window is closed */
    JOBOBJECT_BASIC_ACCOUNTING_INFORMATION ai;
    WaitForSingleObject(pi.hProcess, INFINITE);
    for (;;) {   /* Edge may hand the window to a child process: wait until the whole job is empty */
        if (!QueryInformationJobObject(job, JobObjectBasicAccountingInformation, &ai, sizeof ai, NULL) || ai.ActiveProcesses == 0) break;
        Sleep(500);
    }
    return 0;
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE prev, LPWSTR cmdline, int show) {
    int argc; wchar_t **argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    wchar_t mode = L'c';                                  /* double-click on the file = settings */
    if (argc > 1) { wchar_t *a = argv[1]; if (*a == L'/' || *a == L'-') a++; mode = towlower(*a); }
    if (mode == L's') return run_saver(inst);
    if (mode == L'p') return 0;                           /* the small preview in the dialog stays empty */
    return run_settings();
}
