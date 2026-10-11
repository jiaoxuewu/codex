#include <chrono>
#include <cctype>
#include <cerrno>
#include <iostream>
#include <random>
#include <string>
#include <termios.h>
#include <unistd.h>
#include <sys/select.h>

// 自动恢复终端设置，让字母按下后立即生效，无需回车。
class TerminalMode {
    termios original{};
    bool active = false;
public:
    TerminalMode() {
        if (tcgetattr(STDIN_FILENO, &original) != 0) return;
        termios mode = original;
        mode.c_lflag &= ~(ICANON | ECHO);
        mode.c_cc[VMIN] = 1;
        mode.c_cc[VTIME] = 0;
        active = tcsetattr(STDIN_FILENO, TCSANOW, &mode) == 0;
    }
    bool ready() const { return active; }
    ~TerminalMode() {
        if (active) tcsetattr(STDIN_FILENO, TCSANOW, &original);
    }
};

int main() {
    using Clock = std::chrono::steady_clock;
    std::cout << "\n=== 随机字母打字练习 ===\n"
              << "1. 慢速：每个字母 3 秒，答对 +10 分\n"
              << "2. 中速：每个字母 2 秒，答对 +20 分\n"
              << "3. 快速：每个字母 1 秒，答对 +30 分\n"
              << "共 20 轮；按错或超时进入下一轮；大小写均可；Esc 退出。\n";
    int level = 0;
    for (;;) {
        std::cout << "请选择速度（1/2/3），然后回车：" << std::flush;
        std::string input;
        if (!std::getline(std::cin, input)) return 0;
        if (input == "1" || input == "2" || input == "3") {
            level = input[0] - '0';
            break;
        }
        std::cout << "请输入 1、2 或 3。\n";
    }

    int score = 0, correct = 0, wrong = 0, missed = 0, played = 0;
    bool quit = false;
    {
        TerminalMode terminal;
        if (!terminal.ready()) {
            std::cerr << "请在交互式终端中运行此游戏。\n";
            return 1;
        }
        std::mt19937 rng(std::random_device{}());
        std::uniform_int_distribution<int> letters(0, 25);
        for (int round = 1; round <= 20; ++round) {
            tcflush(STDIN_FILENO, TCIFLUSH);
            char target = static_cast<char>('a' + letters(rng));
            std::cout << "\n[" << round << "/20] 得分 " << score
                      << "  请按： " << target << "  （" << 4 - level
                      << " 秒） " << std::flush;
            auto deadline = Clock::now() + std::chrono::seconds(4 - level);
            bool answered = false;
            while (Clock::now() < deadline) {
                auto remaining = std::chrono::duration_cast<std::chrono::microseconds>(
                    deadline - Clock::now()).count();
                if (remaining <= 0) break;
                timeval timeout{static_cast<long>(remaining / 1000000),
                                static_cast<suseconds_t>(remaining % 1000000)};
                fd_set inputs;
                FD_ZERO(&inputs);
                FD_SET(STDIN_FILENO, &inputs);
                int result = select(STDIN_FILENO + 1, &inputs, nullptr, nullptr, &timeout);
                if (result < 0) {
                    if (errno == EINTR) continue;
                    quit = true;
                    break;
                }
                if (result == 0) break;
                unsigned char key = 0;
                if (read(STDIN_FILENO, &key, 1) != 1) {
                    quit = true;
                    break;
                }
                if (key == 27 || key == 3 || key == 4) {
                    quit = true;
                    break;
                }
                if (!std::isalpha(key)) continue;
                answered = true;
                ++played;
                if (std::tolower(key) == target) {
                    score += level * 10;
                    ++correct;
                    std::cout << "正确！+" << level * 10 << " 分\n";
                } else {
                    ++wrong;
                    std::cout << "按错了（" << key << "），本轮不得分。\n";
                }
                break;
            }
            if (quit) break;
            if (!answered) {
                ++missed;
                ++played;
                std::cout << "超时，本轮不得分。\n";
            }
        }
    }
    std::cout << "\n=== " << (quit ? "已退出" : "练习结束") << " ===\n"
              << "总得分：" << score << "\n"
              << "完成轮数：" << played << " / 20\n"
              << "正确：" << correct << "  错误：" << wrong << "  超时：" << missed << "\n"
              << "准确率：" << (played ? correct * 100 / played : 0) << "%\n";
    return 0;
}
