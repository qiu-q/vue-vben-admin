import os

def list_all_files(root_dir, output_file=None):
  file_paths = []
  for dirpath, dirnames, filenames in os.walk(root_dir):
    for fname in filenames:
      rel_path = os.path.relpath(os.path.join(dirpath, fname), root_dir)
      file_paths.append(rel_path)
  for f in file_paths:
    print(f)
  print(f"\n共有 {len(file_paths)} 个文件。")
  if output_file:
    with open(output_file, "w", encoding="utf-8") as f:
      for path in file_paths:
        f.write(path + "\n")
      f.write(f"\n共有 {len(file_paths)} 个文件。\n")

if __name__ == "__main__":
  import sys
  if len(sys.argv) > 1:
    root = sys.argv[1]
  else:
    root = "."
  out = sys.argv[2] if len(sys.argv) > 2 else None
  list_all_files(root, out)
