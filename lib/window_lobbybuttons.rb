require_relative 'window_host'
class Window_LobbyButtons < Window_List
  def initialize(x,y)
    super(x,y,86,30)
    @items = ["新房间"]
    @button = Surface.load("graphics/lobby/button.png")
    @font = TTF.open("fonts/wqy-microhei.ttc", 16)
    refresh
  end
  def draw_item(index, status=0)
    Surface.blit(@button, status*@button.w/3,0,@button.w/3,@button.h, @contents, 0, 0)
    @font.draw_blended_utf8(@contents,"新房间",16,5,20,10,180)
  end
  def mousemoved(x,y)
    self.index = 0
  end
  def lostfocus(active_window = nil)
    self.index = nil
  end
  def clicked
    @host_window = Window_Host.new(300,200)
  end
  def update
    @host_window.update if @host_window and !@host_window.destroyed?
  end
end
