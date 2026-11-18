# 绘本工坊功能清单

本包拥有专业能力；宿主拥有正文、来源与作者决定。

| 动作 | 用途 | 必填参数 | 效果 |
| --- | --- | --- | --- |
| list_projects | 查找专业工程 |  | read |
| get_project | 读取固定专业工程 | object_id | read |
| save_project | 保存专业工程 | expected_revision, expected_sha256, operation_key, content | managed_write |
| put_page | 维护绘本页 | object_id, expected_revision, expected_sha256, operation_key, page | managed_write |
| remove_page | 移除绘本页 | object_id, expected_revision, expected_sha256, operation_key, page_id | managed_write |
| put_note | 维护页内意见 | object_id, expected_revision, expected_sha256, operation_key, note | managed_write |
| remove_note | 移除页内意见 | object_id, expected_revision, expected_sha256, operation_key, note_id | managed_write |
| check_layout | 检查页序、文字排版与图像分辨率 | object_id | read |
| render_book | 读取离线绘本 | object_id | read |
| export_pdf | 导出固定嵌字绘本PDF | object_id | read |
| page_digest | 读取页内意见基线 | object_id, page_id | read |
| locate_page | 定位固定页与图像来源 | object_id, page_id | read |
| get_source | 读取固定来源 | object_id, source_index | read |
| get_basis | 读取固定专业依据 | object_id, basis_index | read |
| compare_versions | 比较固定修订 | object_id, from_revision, to_revision | read |
| export_project | 导出固定专业报告 | object_id, format | read |
| build_context | 准备有界创作上下文 | object_id, goal, max_chars | read |
| create_handoff | 准备精确AI交接 | object_id, goal | read |
| get_operation | 回读原操作 | operation_key | read |

默认流程、边界及验收见 [docs](docs/README.md)。
