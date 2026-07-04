import ast
from pathlib import Path
root = Path('app/api/v1/endpoints')
for path in sorted(root.rglob('*.py')):
    text = path.read_text(encoding='utf-8')
    try:
        tree = ast.parse(text)
    except Exception as e:
        print('PARSE ERROR', path, e)
        continue
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef):
            has_router = False
            for dec in node.decorator_list:
                if isinstance(dec, ast.Attribute) and isinstance(dec.value, ast.Name) and dec.value.id == 'router' and dec.attr in {'get','post','put','delete','patch','options','head'}:
                    has_router = True
                    break
            if not has_router:
                continue
            has_return = any(isinstance(sub, (ast.Return, ast.Raise)) for sub in ast.walk(node))
            if not has_return:
                print('MISSING', path, node.name, node.lineno)
