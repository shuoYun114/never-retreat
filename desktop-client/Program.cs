using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace NeverRetreat {
  static class Program {
    // 默认地址；不改程序也能换服务器：
    //   1) 命令行参数： NeverRetreat.exe http://192.168.48.202:18081/
    //   2) 环境变量  ： NEVER_RETREAT_URL
    //   3) exe 同目录的 server.txt 第一行
    const string DefaultUrl = "http://syhx3.top:18081/";
    static string ResolveUrl(string[] args) {
      if (args != null && args.Length > 0 && !string.IsNullOrWhiteSpace(args[0])) return args[0].Trim();
      string env = Environment.GetEnvironmentVariable("NEVER_RETREAT_URL");
      if (!string.IsNullOrWhiteSpace(env)) return env.Trim();
      try {
        string cfg = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "server.txt");
        if (File.Exists(cfg)) {
          foreach (string line in File.ReadAllLines(cfg)) {
            string s = line.Trim();
            if (s.Length > 0 && !s.StartsWith("#")) return s;
          }
        }
      } catch { }
      return DefaultUrl;
    }
    [STAThread]
    static void Main(string[] args) {
      string url = ResolveUrl(args);
      if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) {
        MessageBox.Show("游戏地址必须以 http:// 或 https:// 开头：\n" + url, "Never Retreat", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return;
      }
      string edge = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe");
      if (!File.Exists(edge)) {
        MessageBox.Show("未找到 Microsoft Edge。请安装 Edge 后再启动。", "Never Retreat", MessageBoxButtons.OK, MessageBoxIcon.Error);
        return;
      }
      Process.Start(new ProcessStartInfo { FileName = edge, Arguments = "--app=" + url, UseShellExecute = true });
    }
  }
}
