export default function Home() {
  // 简单的客户端重定向
  return (
    <>
      <script dangerouslySetInnerHTML={{
        __html: 'window.location.href = "/login"'
      }} />
      <div>正在跳转到登录页面...</div>
    </>
  )
}
