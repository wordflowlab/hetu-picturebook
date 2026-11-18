import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const fontkitCompatibility = {
  name: "fontkit-standard-prototypes",
  setup(build) {
    build.onLoad(
      { filter: /[\\/]@pdf-lib[\\/]fontkit[\\/]dist[\\/]fontkit\.umd\.js$/ },
      async (args) => {
        const original = await readFile(args.path, "utf8");
        const input_sha256 = hash(original);
        const expected = JSON.parse(
          await readFile("vendor/fontkit-compatibility.json", "utf8"),
        );
        if (input_sha256 !== expected.input_sha256)
          throw Error("fontkit固定输入摘要已变化，须重新核对兼容补丁。");
        const setters = (
            original.match(/subClass\.__proto__ = superClass;/g) ?? []
          ).length,
          getters = (original.match(/return x\.__proto__;/g) ?? []).length;
        if (setters !== 18 || getters !== 1)
          throw Error("fontkit兼容补丁的预期位置已变化。");
        const contents = original
          .replaceAll(
            "subClass.__proto__ = superClass;",
            "Object.setPrototypeOf(subClass, superClass);",
          )
          .replaceAll(
            "return x.__proto__;",
            "return Object.getPrototypeOf(x);",
          );
        await mkdir("dist/licenses", { recursive: true });
        await writeFile(
          "dist/licenses/fontkit-compatibility.json",
          JSON.stringify(
            {
              package: "@pdf-lib/fontkit",
              version: "1.1.1",
              input_sha256,
              output_sha256: hash(contents),
              setters,
              getters,
              change:
                "旧Babel原型访问替换为Object.setPrototypeOf/getPrototypeOf；保留Node25原型禁用和运行权限。",
            },
            null,
            2,
          ) + "\n",
        );
        return {
          contents,
          loader: "js",
          resolveDir: args.path.replace(/[\\/][^\\/]+$/, ""),
        };
      },
    );
  },
};
